import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import {
  advancedReportFiltersSchema,
  advancedReportResponseSchema,
  advancedReportTypeSchema,
  advancedExportFormatSchema,
} from "@/lib/control-center/advanced-report-schema";
import {
  createAdvancedReportWorkbook,
  renderAdvancedReportPdf,
} from "@/lib/control-center/advanced-export-renderers";
import { createAdminClient } from "@/lib/supabase/admin";

const exportJobSchema = z.object({
  id: z.string().uuid(),
  requested_by: z.string().uuid(),
  report_type: advancedReportTypeSchema,
  format: advancedExportFormatSchema,
  filters_snapshot: z.unknown(),
  selected_columns: z.array(z.string()),
  locale: z.enum(["ar", "en"]),
  timezone: z.string(),
  attempts: z.coerce.number().int().min(1).max(3),
});

const MAX_EXPORT_ROWS = 5000;
const PAGE_SIZE = 200;
const EXPORT_TTL_MS = 15 * 60 * 1000;

export async function processAdminExport(jobId: string): Promise<void> {
  const admin = createAdminClient();
  await cleanupExpiredAdminExports();
  const { data: claimed, error: claimError } = await admin.rpc("claim_admin_export_job", {
    p_job: jobId,
  });

  if (claimError) throw new Error("export_claim_failed");
  if (!claimed) return;
  const job = exportJobSchema.parse(claimed);

  try {
    const report = await collectReport(admin, job);
    const generatedAt = new Intl.DateTimeFormat(job.locale, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: job.timezone,
    }).format(new Date());
    const snapshot = {
      reportType: job.report_type,
      locale: job.locale,
      timezone: job.timezone,
      columns: job.selected_columns,
      filters: advancedReportFiltersSchema.parse(job.filters_snapshot),
      generatedAt,
    };
    const output =
      job.format === "pdf"
        ? await renderAdvancedReportPdf(report, snapshot)
        : createAdvancedReportWorkbook(report, snapshot);
    const bytes = Uint8Array.from(output);
    const storagePath = `${job.requested_by}/${job.id}.${job.format}`;
    const contentType =
      job.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const { error: uploadError } = await admin.storage
      .from("admin-exports")
      .upload(storagePath, bytes, { contentType, upsert: false, cacheControl: "0" });
    if (uploadError) throw new Error("export_upload_failed");

    const finishedAt = new Date();
    const { error: completionError } = await admin
      .from("export_jobs")
      .update({
        status: "completed",
        storage_path: storagePath,
        file_sha256: createHash("sha256").update(bytes).digest("hex"),
        row_count: report.total,
        finished_at: finishedAt.toISOString(),
        expires_at: new Date(finishedAt.getTime() + EXPORT_TTL_MS).toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "processing");
    if (completionError) {
      await admin.storage.from("admin-exports").remove([storagePath]);
      throw new Error("export_completion_failed");
    }
  } catch (error) {
    const errorCode = safeErrorCode(error);
    if (job.attempts < 3) {
      const { error: retryError } = await admin
        .from("export_jobs")
        .update({
          status: "queued",
          next_attempt_at: new Date().toISOString(),
          started_at: null,
        })
        .eq("id", job.id)
        .eq("status", "processing");
      if (retryError) throw new Error(errorCode);
      return processAdminExport(job.id);
    }
    await admin
      .from("export_jobs")
      .update({
        status: "failed",
        error_code: errorCode,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "processing");
  }
}

async function collectReport(
  admin: ReturnType<typeof createAdminClient>,
  job: z.infer<typeof exportJobSchema>,
) {
  const filters = advancedReportFiltersSchema.parse(job.filters_snapshot);
  const first = await fetchPage(admin, job, filters, 1);
  if (first.total > MAX_EXPORT_ROWS) throw new Error("export_too_large");
  const rows = [...first.rows];
  const pages = Math.ceil(first.total / PAGE_SIZE);
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(admin, job, filters, page);
    rows.push(...next.rows);
  }
  return { ...first, page: 1, page_size: Math.max(first.total, 1), rows };
}

async function fetchPage(
  admin: ReturnType<typeof createAdminClient>,
  job: z.infer<typeof exportJobSchema>,
  filters: z.infer<typeof advancedReportFiltersSchema>,
  page: number,
) {
  const { data, error } = await admin.rpc("get_admin_advanced_report", {
    p_report_type: job.report_type,
    p_from: filters.from,
    p_to: filters.to,
    p_country: filters.country || undefined,
    p_track: filters.track || undefined,
    p_teacher: filters.teacher || undefined,
    p_status: filters.status || undefined,
    p_sort: filters.sort || undefined,
    p_direction: filters.direction,
    p_page: page,
    p_page_size: PAGE_SIZE,
    p_locale: job.locale,
    p_timezone: job.timezone,
  });
  if (error) throw new Error("export_query_failed");
  return advancedReportResponseSchema.parse(data);
}

async function cleanupExpiredAdminExports() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_admin_export_jobs", {});
  if (error || !Array.isArray(data) || !data.length) return;
  const paths = data.filter((path): path is string => typeof path === "string" && path.length > 0);
  if (paths.length) await admin.storage.from("admin-exports").remove(paths);
}

function safeErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "export_failed";
  return /^[a-z][a-z0-9_]{2,79}$/.test(message) ? message : "export_failed";
}
