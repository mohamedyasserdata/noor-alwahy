import { ShieldCheck } from "lucide-react";

import { AdminSavedViews } from "@/components/admin/admin-saved-views";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AdvancedReportPanel } from "@/components/control-center/advanced-report-panel";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { transitionReportAction } from "@/lib/reports/admin-actions";
import { getAdminReports } from "@/lib/reports/admin-queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

const statusText = {
  ar: {
    draft: "مسودة لدى المعلم",
    approved: "بانتظار مراجعة الإدارة",
    admin_review: "مطلوب تعديل من المعلم",
    visible: "معتمد ومنشور",
  },
  en: {
    draft: "Teacher draft",
    approved: "Pending admin review",
    admin_review: "Revision requested",
    visible: "Approved and published",
  },
} as const;

export async function AdminReportsSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  const query = await searchParams;
  const reports = await getAdminReports({
    studentId: typeof query.studentId === "string" ? query.studentId : undefined,
    teacherId: typeof query.teacherId === "string" ? query.teacherId : undefined,
    status: typeof query.status === "string" ? query.status : undefined,
  });
  const ar = locale === "ar";
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(today.getUTCDate() - 29);
  const updated = query.reportStatus === "updated";
  const errorCode = typeof query.reportError === "string" ? query.reportError : "";
  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="admin-reports-title">
      <header className="max-w-3xl">
        <p className="mb-3 flex items-center gap-2 text-sm font-black text-secondary">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {ar ? "الإدارة · مصادقة متعددة العوامل" : "Administration · Multi-factor protected"}
        </p>
        <h1
          id="admin-reports-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {ar ? "مراجعة التقارير ونشرها" : "Review and publish reports"}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">
          {ar
            ? "راجع البيانات والصياغة، ثم اطلب تعديلًا مسببًا أو اعتمد النسخة وانشرها. لا تظهر أي مسودة للأسرة."
            : "Review the data and wording, then request a reasoned revision or approve and publish the version. No draft is visible to the family."}
        </p>
      </header>
      {updated ? (
        <Alert className="mt-6" variant="success">
          {ar
            ? "حُدث التقرير وسُجلت العملية."
            : "The report was updated and the action was recorded."}
        </Alert>
      ) : null}
      {errorCode ? (
        <Alert className="mt-6" variant="warning">
          {errorCode === "revision_reason_required"
            ? ar
              ? "اكتب سببًا واضحًا لإعادة التقرير إلى المعلم."
              : "Enter a clear reason before returning the report to the teacher."
            : ar
              ? "تعذر تنفيذ العملية. راجع الحقول وحالة التقرير."
              : "The action failed. Review the fields and current report state."}
        </Alert>
      ) : null}
      <AdminSavedViews
        locale={locale}
        pageKey="reports"
        currentParams={Object.fromEntries(
          ["studentId", "teacherId", "status"]
            .map((key) => [key, typeof query[key] === "string" ? query[key] : ""] as const)
            .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
        )}
      />
      <div className="mt-8 grid gap-5">
        {reports.length ? (
          reports.map((report) => (
            <article key={report.id} className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                <div>
                  <h2 className="text-lg font-black text-primary">
                    <Link href={`/admin/students/${report.studentId}`} className="hover:underline">
                      {report.studentName}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Link href={`/admin/teachers/${report.teacherId}`} className="hover:underline">
                      {report.teacherName}
                    </Link>{" "}
                    · {report.periodStart} — {report.periodEnd}
                  </p>
                </div>
                <Badge variant={report.status === "visible" ? "success" : "secondary"}>
                  {statusText[locale][report.status]}
                </Badge>
              </div>

              {report.status === "approved" ? (
                <form
                  action={transitionReportAction.bind(null, locale)}
                  className="mt-5 grid gap-4"
                >
                  <input type="hidden" name="reportId" value={report.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NarrativeField
                      id={report.id}
                      name="summary"
                      label={ar ? "ملخص الأداء" : "Performance summary"}
                      value={report.body.summary}
                    />
                    <NarrativeField
                      id={report.id}
                      name="strengths"
                      label={ar ? "نقاط القوة" : "Strengths"}
                      value={report.body.strengths}
                    />
                    <NarrativeField
                      id={report.id}
                      name="improve"
                      label={ar ? "نقاط التحسين" : "Areas to improve"}
                      value={report.body.improve}
                    />
                    <NarrativeField
                      id={report.id}
                      name="plan"
                      label={ar ? "الخطة القادمة" : "Next plan"}
                      value={report.body.plan}
                    />
                    <NarrativeField
                      id={report.id}
                      name="recommendation"
                      label={ar ? "التوصية" : "Recommendation"}
                      value={report.body.recommendation}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`review-note-${report.id}`}>
                      {ar ? "سبب طلب التعديل" : "Revision reason"}
                    </Label>
                    <textarea
                      id={`review-note-${report.id}`}
                      name="reviewNote"
                      rows={3}
                      maxLength={2000}
                      className="rounded-xl border bg-background p-3"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <details className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <summary className="cursor-pointer font-black text-destructive">
                        {ar ? "مراجعة طلب التعديل" : "Review revision request"}
                      </summary>
                      <p className="my-3 text-sm text-muted-foreground">
                        {ar
                          ? "سيعود التقرير للمعلم مع السبب ولن يظهر للأسرة."
                          : "The report returns to the teacher with the reason and remains hidden from the family."}
                      </p>
                      <AdminSubmitButton
                        label={ar ? "إعادة للمعلم" : "Return to teacher"}
                        pendingLabel="…"
                        variant="destructive"
                        name="status"
                        value="admin_review"
                      />
                    </details>
                    <details className="rounded-xl border border-secondary/25 bg-secondary/5 p-4">
                      <summary className="cursor-pointer font-black text-primary">
                        {ar ? "مراجعة الاعتماد والنشر" : "Review approval and publication"}
                      </summary>
                      <p className="my-3 text-sm text-muted-foreground">
                        {ar
                          ? "سيُحفظ إصدار نهائي ويظهر للطالب وولي الأمر."
                          : "A final version will be saved and shown to the student and guardian."}
                      </p>
                      <AdminSubmitButton
                        label={ar ? "اعتماد ونشر" : "Approve and publish"}
                        pendingLabel="…"
                        name="status"
                        value="visible"
                      />
                    </details>
                  </div>
                </form>
              ) : null}

              {report.status === "admin_review" ? (
                <Alert className="mt-5" variant="warning">
                  <strong>{ar ? "سبب الإعادة:" : "Revision reason:"}</strong>{" "}
                  {report.reviewNote ?? (ar ? "لم يُسجل سبب." : "No reason was recorded.")}
                </Alert>
              ) : null}

              {report.status === "visible" ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {ar
                      ? `الإصدار المنشور رقم ${report.publishedVersion}`
                      : `Published version ${report.publishedVersion}`}
                  </p>
                  <form action={transitionReportAction.bind(null, locale)}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="status" value="draft" />
                    <input type="hidden" name="reviewNote" value="" />
                    <AdminSubmitButton
                      label={ar ? "بدء تصحيح موثق" : "Start a documented correction"}
                      pendingLabel="…"
                      variant="outline"
                    />
                  </form>
                </div>
              ) : null}

              {report.status === "draft" ? (
                <p className="mt-5 text-sm text-muted-foreground">
                  {ar ? "المعلم ما زال يحرر المسودة." : "The teacher is still editing this draft."}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
            {ar ? "لا توجد تقارير." : "No reports yet."}
          </p>
        )}
      </div>
      <AdvancedReportPanel
        locale={locale}
        defaultFrom={defaultFrom.toISOString().slice(0, 10)}
        defaultTo={today.toISOString().slice(0, 10)}
      />
    </section>
  );
}

function NarrativeField({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${name}-${id}`}>{label}</Label>
      <textarea
        id={`${name}-${id}`}
        name={name}
        defaultValue={value}
        rows={4}
        required
        maxLength={2000}
        className="rounded-xl border bg-background p-3"
      />
    </div>
  );
}
