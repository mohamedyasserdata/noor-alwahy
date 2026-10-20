import { ShieldCheck } from "lucide-react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { transitionReportAction } from "@/lib/reports/admin-actions";
import { getAdminReports } from "@/lib/reports/admin-queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function AdminReportsSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  const [reports, query] = await Promise.all([getAdminReports(), searchParams]);
  const ar = locale === "ar";
  const updated = query.reportStatus === "updated";
  const hasError = Boolean(query.reportError);
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
            ? "راجع حالة التقرير ثم انقله إلى الأسرة. لا يستطيع الطالب أو ولي الأمر قراءته قبل النشر."
            : "Review report state before releasing it to the family. Students and guardians cannot read it before publication."}
        </p>
      </header>
      {updated ? (
        <Alert className="mt-6" variant="success">
          {ar ? "حُدثت حالة التقرير." : "Report status updated."}
        </Alert>
      ) : null}
      {hasError ? (
        <Alert className="mt-6" variant="warning">
          {ar ? "تعذر تغيير الحالة المطلوبة." : "The requested status change failed."}
        </Alert>
      ) : null}
      <div className="mt-8 grid gap-4">
        {reports.length ? (
          reports.map((report) => (
            <article
              key={report.id}
              className="grid gap-5 rounded-3xl border bg-card p-5 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-primary">{report.studentName}</h2>
                  <Badge variant={report.status === "visible" ? "success" : "secondary"}>
                    {report.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {report.teacherName} · {report.periodStart} — {report.periodEnd}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.status === "approved" ? (
                  <>
                    <Transition
                      locale={locale}
                      id={report.id}
                      status="admin_review"
                      label={ar ? "إرسال للمراجعة" : "Send to review"}
                    />
                    <Transition
                      locale={locale}
                      id={report.id}
                      status="visible"
                      label={ar ? "نشر للأسرة" : "Publish to family"}
                    />
                  </>
                ) : null}
                {report.status === "admin_review" ? (
                  <Transition
                    locale={locale}
                    id={report.id}
                    status="visible"
                    label={ar ? "نشر للأسرة" : "Publish to family"}
                  />
                ) : null}
                {report.status === "visible" ? (
                  <Transition
                    locale={locale}
                    id={report.id}
                    status="draft"
                    label={ar ? "سحب إلى مسودة" : "Withdraw to draft"}
                  />
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
            {ar ? "لا توجد تقارير." : "No reports yet."}
          </p>
        )}
      </div>
    </section>
  );
}

function Transition({
  locale,
  id,
  status,
  label,
}: {
  locale: AppLocale;
  id: string;
  status: "admin_review" | "visible" | "draft";
  label: string;
}) {
  return (
    <form action={transitionReportAction.bind(null, locale)}>
      <input type="hidden" name="reportId" value={id} />
      <input type="hidden" name="status" value={status} />
      <AdminSubmitButton
        label={label}
        pendingLabel="…"
        variant={status === "visible" ? "gold" : "outline"}
      />
    </form>
  );
}
