import { z } from "zod";

import { renderGradeReportPdf, type GradeReportDocument } from "@/lib/exams/grade-report-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ studentId: z.uuid() });
const querySchema = z.object({ locale: z.enum(["ar", "en"]).default("ar") });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedQuery = querySchema.safeParse({
    locale: new URL(request.url).searchParams.get("locale") ?? "ar",
  });
  if (!parsedParams.success || !parsedQuery.success) return new Response(null, { status: 404 });

  const client = await createClient();
  const { count, error: accessError } = await client
    .from("exam_results")
    .select("id", { count: "exact", head: true })
    .eq("student_id", parsedParams.data.studentId)
    .eq("is_locked", true);
  if (accessError || !count) return new Response(null, { status: 404 });

  const admin = createAdminClient();
  const [studentResult, resultsQuery] = await Promise.all([
    admin.from("students").select("full_name").eq("id", parsedParams.data.studentId).single(),
    admin
      .from("exam_results")
      .select("total,percentage,grade,exam:exams(title_ar,title_en,kind,held_on,max_score)")
      .eq("student_id", parsedParams.data.studentId)
      .eq("is_locked", true)
      .order("created_at", { ascending: true }),
  ]);
  if (studentResult.error || resultsQuery.error || !resultsQuery.data.length)
    return new Response(null, { status: 404 });

  const locale = parsedQuery.data.locale;
  try {
    const pdf = await renderGradeReportPdf({
      locale,
      studentName: studentResult.data.full_name,
      generatedAt: new Date().toISOString(),
      results: resultsQuery.data.map((result) => ({
        title:
          locale === "ar" || !result.exam.title_en ? result.exam.title_ar : result.exam.title_en,
        kind: result.exam.kind,
        heldOn: result.exam.held_on,
        total: Number(result.total),
        maximum: Number(result.exam.max_score),
        percentage: Number(result.percentage),
        grade: result.grade,
      })) as GradeReportDocument["results"],
    });
    return new Response(Uint8Array.from(pdf).buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="grade-report-${parsedParams.data.studentId}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (pdfError) {
    console.error(
      "grade_report_pdf_generation_failed",
      pdfError instanceof Error ? pdfError.message : "unknown_error",
    );
    return Response.json({ error: "pdf_generation_failed" }, { status: 503 });
  }
}
