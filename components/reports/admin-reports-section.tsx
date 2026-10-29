import { ShieldCheck } from "lucide-react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AdvancedReportPanel } from "@/components/control-center/advanced-report-panel";
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
  const requestedStudent = typeof query.student === "string" ? query.student : "";
  const visibleReports = requestedStudent
    ? reports.filter((report) => report.studentId === requestedStudent)
    : reports;
  const ar = locale === "ar";
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(today.getUTCDate() - 29);
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
        {visibleReports.length ? (
          visibleReports.map((report) => (
            <article
              key={report.id}
              className="grid gap-5 rounded-3xl border bg-card p-5 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-primary">{report.studentName}</h2>
                  <Badge variant={report.status === "visible" ? "success" : "secondary"}>
                    {reportStatusInfo(report.status, locale).label}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {report.teacherName} · {report.periodStart} — {report.periodEnd}
                </p>
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <StatusDetail
                    label={ar ? "المرحلة" : "Stage"}
                    value={reportStatusInfo(report.status, locale).stage}
                  />
                  <StatusDetail
                    label={ar ? "من يراه الآن" : "Visible to"}
                    value={reportStatusInfo(report.status, locale).audience}
                  />
                  <StatusDetail
                    label={ar ? "الإجراء التالي" : "Next action"}
                    value={reportStatusInfo(report.status, locale).next}
                  />
                </dl>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.status === "approved" ? (
                  <>
                    <Transition
                      locale={locale}
                      id={report.id}
                      status="admin_review"
                      label={ar ? "إرسال للمراجعة" : "Send to review"}
                      record={`${report.studentName} · ${report.periodStart} — ${report.periodEnd}`}
                      audience={ar ? "الإدارة فقط" : "Administration only"}
                    />
                    <Transition
                      locale={locale}
                      id={report.id}
                      status="visible"
                      label={ar ? "نشر للأسرة" : "Publish to family"}
                      record={`${report.studentName} · ${report.periodStart} — ${report.periodEnd}`}
                      audience={
                        ar ? "الطالب وأولياء الأمور المرتبطون" : "Student and linked guardians"
                      }
                    />
                  </>
                ) : null}
                {report.status === "admin_review" ? (
                  <Transition
                    locale={locale}
                    id={report.id}
                    status="visible"
                    label={ar ? "نشر للأسرة" : "Publish to family"}
                    record={`${report.studentName} · ${report.periodStart} — ${report.periodEnd}`}
                    audience={
                      ar ? "الطالب وأولياء الأمور المرتبطون" : "Student and linked guardians"
                    }
                  />
                ) : null}
                {report.status === "visible" ? (
                  <Transition
                    locale={locale}
                    id={report.id}
                    status="draft"
                    label={ar ? "سحب إلى مسودة" : "Withdraw to draft"}
                    record={`${report.studentName} · ${report.periodStart} — ${report.periodEnd}`}
                    audience={ar ? "الإدارة والمدرس فقط" : "Administration and teacher only"}
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
      <AdvancedReportPanel
        locale={locale}
        defaultFrom={defaultFrom.toISOString().slice(0, 10)}
        defaultTo={today.toISOString().slice(0, 10)}
      />
    </section>
  );
}

function StatusDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-primary">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function reportStatusInfo(status: string, locale: AppLocale) {
  const info = {
    ar: {
      draft: ["مسودة", "مسودة", "المدرس والإدارة", "استكمالها ثم اعتمادها"],
      approved: [
        "معتمد من المدرس",
        "ينتظر الاعتماد",
        "المدرس والإدارة",
        "إرساله لمراجعة الإدارة أو نشره",
      ],
      admin_review: [
        "قيد مراجعة الإدارة",
        "ينتظر الاعتماد",
        "الإدارة والمدرس",
        "النشر للطالب والأسرة",
      ],
      visible: [
        "منشور",
        "منشور",
        "الطالب وأولياء الأمور المرتبطون",
        "لا إجراء؛ يمكن سحبه عند الحاجة",
      ],
    },
    en: {
      draft: ["Draft", "Draft", "Teacher and administration", "Complete and approve it"],
      approved: [
        "Teacher approved",
        "Awaiting approval",
        "Teacher and administration",
        "Send to admin review or publish",
      ],
      admin_review: [
        "Admin review",
        "Awaiting approval",
        "Administration and teacher",
        "Publish to student and family",
      ],
      visible: [
        "Published",
        "Published",
        "Student and linked guardians",
        "No action; withdraw if needed",
      ],
    },
  } as const;
  const value = info[locale][status as keyof (typeof info)["en"]] ?? info[locale].draft;
  return { label: value[0], stage: value[1], audience: value[2], next: value[3] };
}

function Transition({
  locale,
  id,
  status,
  label,
  record,
  audience,
}: {
  locale: AppLocale;
  id: string;
  status: "admin_review" | "visible" | "draft";
  label: string;
  record: string;
  audience: string;
}) {
  return (
    <form action={transitionReportAction.bind(null, locale)}>
      <input type="hidden" name="reportId" value={id} />
      <input type="hidden" name="status" value={status} />
      <AdminSubmitButton
        label={label}
        pendingLabel="…"
        variant={status === "visible" ? "gold" : "outline"}
        confirmation={
          status === "visible" || status === "draft"
            ? {
                kind: status === "visible" ? "publishReport" : "withdrawReport",
                record,
                details: [
                  { label: "audience", value: audience },
                  { label: "status", value: label },
                ],
              }
            : undefined
        }
      />
    </form>
  );
}
