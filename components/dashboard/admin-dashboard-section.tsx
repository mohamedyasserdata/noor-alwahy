import {
  CalendarCheck2,
  CircleAlert,
  ClipboardCheck,
  FileDown,
  GraduationCap,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { TeacherCapacityForecast } from "@/components/dashboard/teacher-capacity-forecast";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getTeacherCapacityForecast } from "@/lib/admin/capacity-forecast";
import { getAdminDashboardSummary, getAdminWorkQueue } from "@/lib/dashboard/admin-work-queue";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function AdminDashboardSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(today.getUTCDate() - 89);
  const from = defaultFrom.toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const [t, summary, workQueue, capacityForecast] = await Promise.all([
    getTranslations({ locale, namespace: "adminDashboard" }),
    getAdminDashboardSummary(),
    getAdminWorkQueue(),
    getTeacherCapacityForecast(),
  ]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const exportParams = new URLSearchParams({ locale, from, to, country: "", currency: "" });
  const ar = locale === "ar";

  return (
    <section
      className="admin-dashboard mx-auto w-full max-w-7xl"
      aria-labelledby="admin-dashboard-title"
    >
      <header className="border-b border-secondary/30 pb-7">
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1
          id="admin-dashboard-title"
          className="mt-3 text-3xl font-black text-primary sm:text-4xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 max-w-3xl leading-8 text-muted-foreground">
          {ar
            ? "ابدأ بما يحتاج تدخلًا الآن، ثم راجع سعة المعلمين والطلاب المنتظرين من مكان واحد."
            : "Start with what needs action now, then review teacher capacity and waiting students in one place."}
        </p>
      </header>

      <div className="admin-dashboard-metrics mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Users />}
          label={t("metrics.students")}
          value={number.format(summary.students)}
        />
        <Metric
          icon={<GraduationCap />}
          label={t("metrics.teachers")}
          value={number.format(summary.teachers)}
        />
        <Metric
          icon={<UserRoundCheck />}
          label={t("metrics.subscriptions")}
          value={number.format(summary.subscriptions)}
        />
        <Metric
          icon={<CalendarCheck2 />}
          label={ar ? "حصص اليوم" : "Today's sessions"}
          value={number.format(summary.sessionsToday)}
        />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <section className="rounded-3xl border bg-card p-5 shadow-card sm:p-6">
          <SectionTitle
            icon={<CircleAlert />}
            title={ar ? "يحتاج تدخل الإدارة" : "Needs admin action"}
            description={
              ar
                ? "الأعمال التي يجب متابعتها، مرتبة في قائمة واحدة."
                : "Tasks requiring follow-up, in one clear list."
            }
          />
          <div className="mt-5 grid divide-y">
            <ActionRow
              href="/admin/applications"
              label={ar ? "طلبات التحاق جديدة" : "New student applications"}
              value={number.format(workQueue.newApplications)}
            />
            <ActionRow
              href="/admin/students?workflow=awaiting_assignment"
              label={ar ? "طلاب بانتظار تعيين معلم" : "Students awaiting a teacher"}
              value={number.format(workQueue.awaitingAssignment)}
            />
            <ActionRow
              href="/admin/reports?status=approved"
              label={ar ? "تقارير تنتظر مراجعة الإدارة" : "Reports pending admin review"}
              value={number.format(workQueue.reportsPendingReview)}
            />
            <ActionRow
              href={
                workQueue.firstZoomReviewStudentId
                  ? `/admin/students/${workQueue.firstZoomReviewStudentId}?zoomReview=pending`
                  : "/admin/students"
              }
              label={ar ? "روابط حصص تنتظر المراجعة" : "Lesson links awaiting review"}
              value={number.format(workQueue.zoomReviewsPending)}
            />
            <ActionRow
              href="/admin/attendance"
              label={ar ? "حصص ينقصها حضور المعلم" : "Sessions missing teacher attendance"}
              value={number.format(workQueue.missingTeacherAttendance)}
            />
            <ActionRow
              href="/admin/teacher-applications"
              label={ar ? "طلبات معلمين تحتاج متابعة" : "Teacher applications requiring action"}
              value={number.format(workQueue.teacherApplications)}
            />
          </div>
          {workQueue.pendingZoomReviews.length ? (
            <div className="mt-5 rounded-2xl border border-secondary/25 bg-secondary/5 p-3">
              <p className="px-2 pb-2 text-sm font-black text-primary">
                {ar ? "روابط جاهزة للمراجعة" : "Links ready for review"}
              </p>
              <div className="grid gap-1">
                {workQueue.pendingZoomReviews.slice(0, 4).map((review) => (
                  <Link
                    key={review.id}
                    href={`/admin/students/${review.studentId}?zoomReview=pending`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm outline-none hover:bg-accent/45 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 truncate font-bold text-primary">
                      {review.studentName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(review.scheduledAt))}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border bg-card p-5 shadow-card sm:p-6">
          <SectionTitle
            icon={<ClipboardCheck />}
            title={ar ? "إجراءات سريعة" : "Quick actions"}
            description={
              ar
                ? "الوصول مباشرة إلى أكثر المهام استخدامًا."
                : "Open the most common tasks directly."
            }
            blue
          />
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(
              [
                [ar ? "طلبات الالتحاق" : "Applications", "/admin/applications"],
                [ar ? "تعيين الطلاب" : "Assignments", "/admin/assignments"],
                [ar ? "الجداول" : "Schedule", "/admin/schedule"],
                [ar ? "التقارير" : "Reports", "/admin/reports"],
              ] satisfies ReadonlyArray<readonly [string, string]>
            ).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-12 items-center justify-center rounded-xl border border-secondary/20 bg-accent/25 px-3 py-2 text-center text-sm font-black text-primary transition-colors hover:border-secondary/45 hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <TeacherCapacityForecast locale={locale} data={capacityForecast} />

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <p className="text-sm text-muted-foreground">
          {ar ? "تنزيل نسخة شاملة من بيانات المتابعة" : "Download a complete follow-up snapshot"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <a href={`/api/admin/dashboard/export?${exportParams.toString()}&format=pdf`} download>
              <FileDown aria-hidden="true" /> {t("exports.pdf")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <a href={`/api/admin/dashboard/export?${exportParams.toString()}&format=xlsx`} download>
              <FileDown aria-hidden="true" /> {t("exports.xlsx")}
            </a>
          </Button>
        </div>
      </footer>
    </section>
  );
}

function SectionTitle({
  icon,
  title,
  description,
  blue = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  blue?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full ${blue ? "bg-[#dfedff] text-[#2563b8]" : "bg-[#fff0d1] text-[#a76600]"} [&>svg]:size-5`}
      >
        {icon}
      </span>
      <div>
        <h2 className="text-xl font-black text-primary">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ActionRow({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="font-bold text-foreground">{label}</span>
      <span className="font-black text-primary" dir="auto">
        {value}
      </span>
    </Link>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="admin-metric-card rounded-3xl border bg-card p-5 shadow-card">
      <span className="admin-metric-icon grid size-12 place-items-center rounded-full bg-primary text-secondary [&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-4 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black text-primary" dir="auto">
        {value}
      </p>
    </article>
  );
}
