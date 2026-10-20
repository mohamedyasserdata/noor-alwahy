import { z } from "zod";

import { renderReportPdf, type ReportPdfDocument } from "@/lib/reports/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.uuid() });
const querySchema = z.object({ locale: z.enum(["ar", "en"]).default("ar") });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedQuery = querySchema.safeParse({
    locale: new URL(request.url).searchParams.get("locale") ?? "ar",
  });
  if (!parsedParams.success || !parsedQuery.success) return new Response(null, { status: 404 });

  const client = await createClient();
  const { data: accessible, error: accessError } = await client
    .from("reports")
    .select("id")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (accessError || !accessible) return new Response(null, { status: 404 });

  const admin = createAdminClient();
  const { data: report, error } = await admin
    .from("reports")
    .select("id,student_id,teacher_id,period_type,period_start,period_end,body")
    .eq("id", accessible.id)
    .single();
  if (error) return new Response(null, { status: 404 });
  const [studentResult, teacherResult] = await Promise.all([
    admin.from("students").select("full_name").eq("id", report.student_id).single(),
    admin.from("teachers").select("profile_id").eq("id", report.teacher_id).single(),
  ]);
  if (studentResult.error || teacherResult.error) return new Response(null, { status: 404 });
  const { data: teacherProfile, error: profileError } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", teacherResult.data.profile_id)
    .single();
  if (profileError) return new Response(null, { status: 404 });

  try {
    const pdf = await renderReportPdf({
      locale: parsedQuery.data.locale,
      studentName: studentResult.data.full_name,
      teacherName: teacherProfile.full_name,
      periodType: report.period_type as "weekly" | "monthly",
      periodStart: report.period_start,
      periodEnd: report.period_end,
      generatedAt: new Date().toISOString(),
      body: report.body as ReportPdfDocument["body"],
    });
    return new Response(Uint8Array.from(pdf).buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="report-${report.id}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (pdfError) {
    console.error(
      "report_pdf_generation_failed",
      pdfError instanceof Error ? pdfError.message : "unknown_error",
    );
    return Response.json({ error: "pdf_generation_failed" }, { status: 503 });
  }
}
