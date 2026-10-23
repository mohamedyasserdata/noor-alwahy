"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileClock, RefreshCw, TableProperties } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  advancedReportColumns,
  advancedReportResponseSchema,
  reportColumnLabel,
  type AdvancedReportResponse,
  type AdvancedReportType,
} from "@/lib/control-center/advanced-report-schema";

type Job = {
  id: string;
  report_type: AdvancedReportType;
  format: "pdf" | "xlsx";
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  row_count: number | null;
  error_code: string | null;
  created_at: string;
  finished_at: string | null;
  expires_at: string | null;
};

export function AdvancedReportPanel({
  locale,
  defaultFrom,
  defaultTo,
}: {
  locale: "ar" | "en";
  defaultFrom: string;
  defaultTo: string;
}) {
  const ar = locale === "ar";
  const [reportType, setReportType] = useState<AdvancedReportType>("students");
  const [columns, setColumns] = useState<string[]>([...advancedReportColumns.students].slice(0, 6));
  const [filters, setFilters] = useState({
    from: defaultFrom,
    to: defaultTo,
    country: "",
    status: "",
    sort: "",
    direction: "asc" as "asc" | "desc",
    timezone: "Africa/Cairo",
  });
  const [preview, setPreview] = useState<AdvancedReportResponse | null>(null);
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState<"preview" | "pdf" | "xlsx" | "" | `retry:${string}`>("");
  const [error, setError] = useState("");
  const availableColumns = advancedReportColumns[reportType];

  const fetchJobs = useCallback(async () => {
    const response = await fetch(`/api/admin/exports?locale=${locale}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { jobs?: Job[] };
    setJobs(payload.jobs ?? []);
  }, [locale]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "queued" || job.status === "processing")) return;
    const timer = window.setInterval(() => void fetchJobs(), 1500);
    return () => window.clearInterval(timer);
  }, [fetchJobs, jobs]);

  const query = useMemo(() => {
    const value = new URLSearchParams({
      reportType,
      locale,
      from: filters.from,
      to: filters.to,
      country: filters.country,
      status: filters.status,
      sort: filters.sort,
      direction: filters.direction,
      timezone: filters.timezone,
      page: String(page),
      pageSize: "25",
    });
    return value.toString();
  }, [filters, locale, page, reportType]);

  async function loadPreview(targetPage = page) {
    setBusy("preview");
    setError("");
    const params = new URLSearchParams(query);
    params.set("page", String(targetPage));
    const response = await fetch(`/api/admin/reports/advanced?${params}`, { cache: "no-store" });
    const parsed = advancedReportResponseSchema.safeParse(await response.json().catch(() => null));
    if (!response.ok || !parsed.success) {
      setError(ar ? "تعذر تحميل التقرير." : "The report could not be loaded.");
    } else {
      setPreview(parsed.data);
      setPage(targetPage);
    }
    setBusy("");
  }

  async function queueExport(format: "pdf" | "xlsx") {
    setBusy(format);
    setError("");
    const response = await fetch("/api/admin/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType,
        format,
        locale,
        timezone: filters.timezone,
        columns,
        filters: {
          from: filters.from,
          to: filters.to,
          country: filters.country,
          track: "",
          teacher: "",
          status: filters.status,
          sort: filters.sort,
          direction: filters.direction,
        },
      }),
    });
    if (!response.ok) setError(ar ? "تعذر إنشاء مهمة التصدير." : "Could not queue the export.");
    await fetchJobs();
    setBusy("");
  }

  async function retry(jobId: string) {
    setBusy(`retry:${jobId}`);
    await fetch(`/api/admin/exports/${jobId}/retry?locale=${locale}`, { method: "POST" });
    await fetchJobs();
    setBusy("");
  }

  function changeType(value: AdvancedReportType) {
    setReportType(value);
    setColumns([...advancedReportColumns[value]].slice(0, 6));
    setPreview(null);
    setPage(1);
  }

  const pageCount = preview ? Math.max(1, Math.ceil(preview.total / preview.page_size)) : 1;
  return (
    <section className="mt-12 border bg-card shadow-card" aria-labelledby="advanced-report-title">
      <header className="border-b p-6 sm:p-8">
        <p className="flex items-center gap-2 text-sm font-black text-secondary">
          <TableProperties className="size-4" aria-hidden="true" />
          {ar ? "تقارير الإدارة المتقدمة" : "Advanced administration reports"}
        </p>
        <h2 id="advanced-report-title" className="mt-2 text-2xl font-black text-primary">
          {ar ? "صفوف مفلترة وتصدير خاص" : "Filtered rows and private exports"}
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          {ar
            ? "اختر الأعمدة والفترة، راجع الصفوف المرقمة، ثم أنشئ PDF أو Excel في مساحة خاصة برابط قصير العمر."
            : "Choose columns and period, review paginated rows, then create a private PDF or Excel file with a short-lived link."}
        </p>
      </header>

      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-4">
        <Field label={ar ? "نوع التقرير" : "Report type"}>
          <select
            value={reportType}
            onChange={(event) => changeType(event.target.value as AdvancedReportType)}
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            {(["students", "sessions", "finance", "interventions"] as const).map((type) => (
              <option key={type} value={type}>
                {reportName(type, locale)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ar ? "من" : "From"}>
          <Input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
        </Field>
        <Field label={ar ? "إلى" : "To"}>
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
        </Field>
        <Field label={ar ? "الدولة" : "Country"}>
          <Input
            value={filters.country}
            maxLength={2}
            placeholder={ar ? "مثال: EG" : "e.g. EG"}
            dir="ltr"
            onChange={(event) =>
              setFilters({ ...filters, country: event.target.value.toUpperCase() })
            }
          />
        </Field>
        <Field label={ar ? "الحالة" : "Status"}>
          <Input
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          />
        </Field>
        <Field label={ar ? "الترتيب" : "Sort by"}>
          <select
            value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value })}
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            <option value="">{ar ? "الافتراضي" : "Default"}</option>
            {sortableColumns(reportType).map((column) => (
              <option key={column} value={column}>
                {reportColumnLabel(column, locale)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={ar ? "الاتجاه" : "Direction"}>
          <select
            value={filters.direction}
            onChange={(event) =>
              setFilters({ ...filters, direction: event.target.value as "asc" | "desc" })
            }
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            <option value="asc">{ar ? "تصاعدي" : "Ascending"}</option>
            <option value="desc">{ar ? "تنازلي" : "Descending"}</option>
          </select>
        </Field>
        <Field label={ar ? "المنطقة الزمنية" : "Time zone"}>
          <Input
            value={filters.timezone}
            dir="ltr"
            onChange={(event) => setFilters({ ...filters, timezone: event.target.value })}
          />
        </Field>
      </div>

      <fieldset className="border-y p-6 sm:p-8">
        <legend className="px-2 font-black text-primary">
          {ar ? "الأعمدة المحفوظة في التصدير" : "Columns saved in the export"}
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {availableColumns.map((column) => (
            <label key={column} className="flex min-h-11 items-center gap-3 border px-3 text-sm">
              <input
                type="checkbox"
                checked={columns.includes(column)}
                onChange={(event) =>
                  setColumns(
                    event.target.checked
                      ? [...columns, column]
                      : columns.filter((selected) => selected !== column),
                  )
                }
              />
              {reportColumnLabel(column, locale)}
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="m-6 border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 p-6 sm:p-8">
        <Button type="button" onClick={() => void loadPreview(1)} disabled={busy !== ""}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {busy === "preview" ? "…" : ar ? "عرض الصفوف" : "Preview rows"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void queueExport("pdf")}
          disabled={!columns.length || busy !== ""}
        >
          {busy === "pdf" ? "…" : "PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void queueExport("xlsx")}
          disabled={!columns.length || busy !== ""}
        >
          {busy === "xlsx" ? "…" : "Excel"}
        </Button>
      </div>

      {preview ? (
        <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {columns.map((column) => (
                    <th key={column} className="border-b p-3 text-start font-black text-primary">
                      {reportColumnLabel(column, locale)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={`${page}-${index}`} className="border-b last:border-0">
                    {columns.map((column) => (
                      <td key={column} className="p-3 align-top">
                        {display(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4 p-4">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || busy !== ""}
              onClick={() => void loadPreview(page - 1)}
            >
              {ar ? "السابق" : "Previous"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {pageCount} · {preview.total}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= pageCount || busy !== ""}
              onClick={() => void loadPreview(page + 1)}
            >
              {ar ? "التالي" : "Next"}
            </Button>
          </div>
        </div>
      ) : null}

      <section className="border-t p-6 sm:p-8" aria-labelledby="export-jobs-title">
        <h3
          id="export-jobs-title"
          className="flex items-center gap-2 text-lg font-black text-primary"
        >
          <FileClock className="size-5 text-secondary" aria-hidden="true" />
          {ar ? "ملفاتك المؤقتة" : "Your temporary files"}
        </h3>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void fetchJobs()}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {ar ? "تحديث الملفات" : "Refresh files"}
        </Button>
        <div className="mt-4 grid gap-3">
          {jobs.length ? (
            jobs.map((job) => (
              <article
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-4 border p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <b>
                      {reportName(job.report_type, locale)} · {job.format.toUpperCase()}
                    </b>
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "success"
                          : job.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <small className="mt-1 block text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(job.created_at))}
                    {job.row_count == null ? "" : ` · ${job.row_count}`}
                  </small>
                </div>
                {job.status === "completed" ? (
                  <a
                    href={`/api/admin/exports/${job.id}/download?locale=${locale}`}
                    className="inline-flex min-h-11 items-center gap-2 border px-4 font-bold text-primary"
                  >
                    <Download className="size-4" aria-hidden="true" /> {ar ? "تنزيل" : "Download"}
                  </a>
                ) : job.status === "failed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void retry(job.id)}
                    disabled={busy !== ""}
                  >
                    {busy === `retry:${job.id}` ? "…" : ar ? "إعادة المحاولة" : "Retry"}
                  </Button>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-muted-foreground">{ar ? "لا توجد ملفات بعد." : "No files yet."}</p>
          )}
        </div>
      </section>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function reportName(type: AdvancedReportType, locale: "ar" | "en") {
  const values: Record<AdvancedReportType, [string, string]> = {
    students: ["الطلاب", "Students"],
    sessions: ["الحصص", "Sessions"],
    finance: ["المالية", "Finance"],
    interventions: ["التدخلات", "Interventions"],
  };
  return values[type][locale === "ar" ? 0 : 1];
}
function sortableColumns(type: AdvancedReportType) {
  return {
    students: ["student_no", "full_name", "country", "status"],
    sessions: ["scheduled_at", "student", "teacher", "status"],
    finance: ["invoice_no", "student", "currency", "status", "due_date", "created_at"],
    interventions: ["rule_type", "subject_type", "status", "first_detected_at", "last_detected_at"],
  }[type];
}
function display(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value).replaceAll("_", " ");
}
