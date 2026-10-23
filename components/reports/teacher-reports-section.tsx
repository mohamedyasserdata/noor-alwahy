import { BarChart3, CheckCircle2, Download, FilePenLine, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { approveReportAction, saveReportDraftAction } from "@/lib/reports/actions";
import { getTeacherReportsData } from "@/lib/reports/queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

const copy = {
  ar: {
    eyebrow: "ملف الطالب التربوي",
    title: "تقارير واضحة، بأرقام موثوقة",
    description:
      "اكتب الحكم التربوي فقط؛ الحفظ والحضور ومتوسط التقييم تُحسب من السجلات المقفلة آليًا.",
    newTitle: "تقرير جديد",
    newHint: "احفظ المسودة أولًا لمراجعة المؤشرات قبل الاعتماد.",
    student: "الطالب",
    choose: "اختر طالبًا",
    type: "الدورية",
    weekly: "أسبوعي",
    monthly: "شهري",
    start: "بداية الفترة",
    end: "نهاية الفترة",
    summary: "ملخص التقدم",
    strengths: "نقاط القوة",
    improve: "ما يحتاج إلى تحسين",
    plan: "خطة الفترة القادمة",
    recommendation: "توصية للطالب وولي الأمر",
    template: "قالب التقرير المعتمد",
    noTemplate: "بدون قالب",
    save: "حفظ المسودة",
    saving: "جارٍ الحفظ…",
    approve: "اعتماد التقرير",
    approving: "جارٍ الاعتماد…",
    saved: "حُفظت المسودة وحُدّثت المؤشرات.",
    approved: "اعتُمد التقرير وأُرسل إلى دورة مراجعة الإدارة.",
    invalid_fields: "راجع الفترة والحقول؛ كل حقل تربوي مطلوب.",
    duplicate_period: "يوجد تقرير لهذا الطالب والدورية وتاريخ البداية.",
    request_failed: "تعذر تنفيذ الطلب. حاول مرة أخرى.",
    listTitle: "سجل التقارير",
    empty: "لم تُنشأ تقارير بعد.",
    pages: "صفحات متقنة",
    attendance: "الحضور",
    evaluation: "متوسط التقييم",
    noData: "لا بيانات",
    download: "تنزيل PDF",
    status: {
      draft: "مسودة",
      approved: "معتمد",
      admin_review: "قيد مراجعة الإدارة",
      visible: "ظاهر للأسرة",
    },
  },
  en: {
    eyebrow: "Student learning record",
    title: "Clear reports, trusted numbers",
    description:
      "Write the educational judgement; memorisation, attendance and evaluation averages come from locked records.",
    newTitle: "New report",
    newHint: "Save the draft first to review its metrics before approval.",
    student: "Student",
    choose: "Choose a student",
    type: "Period",
    weekly: "Weekly",
    monthly: "Monthly",
    start: "Period start",
    end: "Period end",
    summary: "Progress summary",
    strengths: "Strengths",
    improve: "Areas to improve",
    plan: "Next-period plan",
    recommendation: "Recommendation for student and guardian",
    template: "Approved report template",
    noTemplate: "No template",
    save: "Save draft",
    saving: "Saving…",
    approve: "Approve report",
    approving: "Approving…",
    saved: "Draft saved and metrics refreshed.",
    approved: "Report approved and sent to the admin review cycle.",
    invalid_fields: "Check the period and fields; every educational field is required.",
    duplicate_period: "A report already exists for this student, period and start date.",
    request_failed: "The request could not be completed. Try again.",
    listTitle: "Report record",
    empty: "No reports have been created yet.",
    pages: "Mastered pages",
    attendance: "Attendance",
    evaluation: "Evaluation average",
    noData: "No data",
    download: "Download PDF",
    status: {
      draft: "Draft",
      approved: "Approved",
      admin_review: "Admin review",
      visible: "Visible to family",
    },
  },
} as const;

export async function TeacherReportsSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  const [data, query] = await Promise.all([getTeacherReportsData(), searchParams]);
  const t = copy[locale];
  const status = typeof query.reportStatus === "string" ? query.reportStatus : "";
  const error = typeof query.reportError === "string" ? query.reportError : "";

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="teacher-reports-title">
      <header className="grid gap-6 border-b pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-black text-secondary">{t.eyebrow}</p>
          <h1
            id="teacher-reports-title"
            className="text-3xl font-black text-balance text-primary sm:text-4xl"
          >
            {t.title}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm font-bold text-primary">
          <ShieldCheck className="size-5 text-secondary" aria-hidden="true" />
          {data.reports.length} {t.listTitle}
        </div>
      </header>

      {status ? (
        <Alert className="mt-6" variant="success" aria-live="polite">
          {status === "approved" ? t.approved : t.saved}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning" aria-live="polite">
          {t[
            error as keyof Pick<typeof t, "invalid_fields" | "duplicate_period" | "request_failed">
          ] ?? t.request_failed}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
        <aside className="self-start rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg xl:sticky xl:top-6">
          <FilePenLine className="size-8 text-secondary" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-black">{t.newTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-primary-foreground/75">{t.newHint}</p>
          <ReportForm locale={locale} students={data.students} templates={data.templates} t={t} />
        </aside>

        <div>
          <div className="mb-5 flex items-center gap-3">
            <BarChart3 className="size-6 text-secondary" aria-hidden="true" />
            <h2 className="text-2xl font-black text-primary">{t.listTitle}</h2>
          </div>
          {data.reports.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
              {t.empty}
            </div>
          ) : (
            <div className="grid gap-6">
              {data.reports.map((report) => (
                <article
                  key={report.id}
                  className="overflow-hidden rounded-3xl border bg-card shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-muted/35 p-5 sm:p-6">
                    <div>
                      <h3 className="text-xl font-black text-primary">{report.studentName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {report.period_start} — {report.period_end}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          report.status === "visible"
                            ? "success"
                            : report.status === "draft"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {t.status[report.status]}
                      </Badge>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/api/pdf/reports/${report.id}?locale=${locale}`}>
                          <Download className="size-4" aria-hidden="true" />
                          {t.download}
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x border-b text-center divide-x-reverse">
                    <Metric label={t.pages} value={String(report.body.metrics.mastered_pages)} />
                    <Metric
                      label={t.attendance}
                      value={
                        report.body.metrics.attendance.rate == null
                          ? t.noData
                          : `${report.body.metrics.attendance.rate}%`
                      }
                    />
                    <Metric
                      label={t.evaluation}
                      value={
                        report.body.metrics.evaluation_average == null
                          ? t.noData
                          : `${report.body.metrics.evaluation_average}%`
                      }
                    />
                  </div>
                  {report.status === "draft" ? (
                    <div className="p-5 sm:p-6">
                      <ReportForm
                        locale={locale}
                        students={data.students}
                        templates={data.templates}
                        t={t}
                        report={report}
                      />
                      <form
                        action={approveReportAction.bind(null, locale)}
                        className="mt-5 flex justify-end border-t pt-5"
                      >
                        <input type="hidden" name="reportId" value={report.id} />
                        <AdminSubmitButton label={t.approve} pendingLabel={t.approving} />
                      </form>
                    </div>
                  ) : (
                    <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                      <Narrative label={t.summary} value={report.body.summary} />
                      <Narrative label={t.strengths} value={report.body.strengths} />
                      <Narrative label={t.improve} value={report.body.improve} />
                      <Narrative label={t.plan} value={report.body.plan} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type T = (typeof copy)["ar"] | (typeof copy)["en"];
type Report = Awaited<ReturnType<typeof getTeacherReportsData>>["reports"][number];

function ReportForm({
  locale,
  students,
  templates,
  t,
  report,
}: {
  locale: AppLocale;
  students: { id: string; name: string }[];
  templates: Awaited<ReturnType<typeof getTeacherReportsData>>["templates"];
  t: T;
  report?: Report;
}) {
  const fieldClass =
    "min-h-28 w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <form action={saveReportDraftAction.bind(null, locale)} className="mt-6 grid gap-4">
      {report ? <input type="hidden" name="reportId" value={report.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.template} htmlFor={`template-${report?.id ?? "new"}`}>
          <select
            id={`template-${report?.id ?? "new"}`}
            name="templateVersionId"
            defaultValue={report?.content_template_version_id ?? ""}
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
          >
            <option value="">{t.noTemplate}</option>
            {templates
              .filter((template) => template.locale === locale)
              .map((template) => (
                <option key={template.id} value={template.id}>
                  {locale === "ar" || !template.nameEn ? template.nameAr : template.nameEn} · v
                  {template.version}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t.student} htmlFor={`student-${report?.id ?? "new"}`}>
          <select
            id={`student-${report?.id ?? "new"}`}
            name="studentId"
            defaultValue={report?.student_id ?? ""}
            disabled={Boolean(report)}
            required
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground disabled:opacity-70"
          >
            <option value="" disabled>
              {t.choose}
            </option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          {report ? <input type="hidden" name="studentId" value={report.student_id} /> : null}
        </Field>
        <Field label={t.type} htmlFor={`type-${report?.id ?? "new"}`}>
          <select
            id={`type-${report?.id ?? "new"}`}
            name="periodType"
            defaultValue={report?.period_type ?? "weekly"}
            disabled={Boolean(report)}
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground disabled:opacity-70"
          >
            <option value="weekly">{t.weekly}</option>
            <option value="monthly">{t.monthly}</option>
          </select>
          {report ? <input type="hidden" name="periodType" value={report.period_type} /> : null}
        </Field>
        <DateField
          name="periodStart"
          label={t.start}
          value={report?.period_start}
          disabled={Boolean(report)}
          suffix={report?.id ?? "new"}
        />
        <DateField
          name="periodEnd"
          label={t.end}
          value={report?.period_end}
          disabled={Boolean(report)}
          suffix={report?.id ?? "new"}
        />
      </div>
      {(["summary", "strengths", "improve", "plan", "recommendation"] as const).map((name) => (
        <Field key={name} label={t[name]} htmlFor={`${name}-${report?.id ?? "new"}`}>
          <textarea
            id={`${name}-${report?.id ?? "new"}`}
            name={name}
            defaultValue={report?.body[name] ?? ""}
            required
            maxLength={2000}
            className={fieldClass}
          />
        </Field>
      ))}
      <div className="flex justify-end">
        <Button type="submit" variant={report ? "default" : "gold"}>
          {report ? t.save : t.save}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
function DateField({
  name,
  label,
  value,
  disabled,
  suffix,
}: {
  name: string;
  label: string;
  value?: string;
  disabled: boolean;
  suffix: string;
}) {
  return (
    <Field label={label} htmlFor={`${name}-${suffix}`}>
      <Input
        id={`${name}-${suffix}`}
        name={name}
        type="date"
        defaultValue={value}
        disabled={disabled}
        required
      />
      {disabled ? <input type="hidden" name={name} value={value} /> : null}
    </Field>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-4">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-black text-primary tabular-nums">{value}</p>
    </div>
  );
}
function Narrative({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-black text-primary">
        <CheckCircle2 className="size-4 text-secondary" aria-hidden="true" />
        {label}
      </p>
      <p className="leading-7 text-muted-foreground">{value}</p>
    </div>
  );
}
