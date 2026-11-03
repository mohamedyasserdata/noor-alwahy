import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { getAdminStudentProfile } from "@/lib/admin/student-profile";

type Data = NonNullable<Awaited<ReturnType<typeof getAdminStudentProfile>>>;

export function AdminStudentProfile({ locale, data }: { locale: AppLocale; data: Data }) {
  const ar = locale === "ar";
  const currentTeacher = data.currentAssignment
    ? one(data.currentAssignment.teacher)?.profile
    : null;
  const teacherProfile = one(currentTeacher);
  const latestReport = data.reports[0];
  const latestEvaluation = data.evaluations[0];
  const subscription = data.subscriptions[0];
  const assignmentHref = `/admin/assignments?studentId=${data.student.id}${
    data.student.trackId ? `&trackId=${data.student.trackId}` : ""
  }`;

  return (
    <section
      className="mx-auto w-full max-w-7xl"
      aria-labelledby="student-profile-title"
      data-testid="admin-student-profile"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/students">
            <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
            {ar ? "العودة إلى مركز الطلاب" : "Back to student center"}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${assignmentHref}`}>{ar ? "إدارة التعيين" : "Manage assignment"}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/schedule?studentId=${data.student.id}`}>
              {ar ? "جدول الطالب" : "Student schedule"}
            </Link>
          </Button>
        </div>
      </div>

      <header className="mt-5 rounded-3xl border border-secondary/25 bg-card p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black text-secondary">
              {ar ? "ملف الطالب الإداري" : "Administrative student profile"}
            </p>
            <h1
              id="student-profile-title"
              className="mt-2 text-3xl font-black text-primary sm:text-4xl"
            >
              {data.student.full_name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              <bdi>{data.student.student_no}</bdi> ·{" "}
              {data.student.trackName ?? (ar ? "المسار غير محدد" : "No track")}
              {data.student.levelName ? ` · ${data.student.levelName}` : ""}
            </p>
          </div>
          <Badge variant={data.student.status === "active" ? "success" : "outline"}>
            {studentStatus(data.student.status, ar)}
          </Badge>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          icon={<GraduationCap />}
          label={ar ? "المعلم الحالي" : "Current teacher"}
          value={teacherProfile?.full_name ?? (ar ? "بانتظار التعيين" : "Awaiting assignment")}
        />
        <Summary
          icon={<ChartNoAxesCombined />}
          label={ar ? "الحضور" : "Attendance"}
          value={
            data.attendance.rate === null
              ? ar
                ? "لا توجد سجلات"
                : "No records"
              : `${data.attendance.rate}% · ${data.attendance.attended}/${data.attendance.total}`
          }
        />
        <Summary
          icon={<BookOpenCheck />}
          label={ar ? "تقدم المصحف" : "Quran progress"}
          value={
            ar
              ? `${data.progress.masteredPages} صفحة متقنة`
              : `${data.progress.masteredPages} mastered pages`
          }
        />
        <Summary
          icon={<CreditCard />}
          label={ar ? "الاشتراك" : "Subscription"}
          value={
            subscription
              ? subscriptionStatus(subscription.status, ar)
              : ar
                ? "لا يوجد اشتراك"
                : "No subscription"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="grid gap-6">
          <Panel
            icon={<ClipboardCheck />}
            title={ar ? "آخر تقييم وتقرير" : "Latest evaluation and report"}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Record
                title={ar ? "آخر تقييم مقفل" : "Latest locked evaluation"}
                primary={
                  latestEvaluation
                    ? `${Number(latestEvaluation.total_score)}%`
                    : ar
                      ? "لا يوجد تقييم"
                      : "No evaluation"
                }
                secondary={
                  latestEvaluation?.locked_at
                    ? formatDate(latestEvaluation.locked_at, locale)
                    : undefined
                }
              />
              <Record
                title={ar ? "آخر تقرير" : "Latest report"}
                primary={
                  latestReport
                    ? reportStatus(latestReport.status, ar)
                    : ar
                      ? "لا يوجد تقرير"
                      : "No report"
                }
                secondary={
                  latestReport
                    ? `${latestReport.period_start} — ${latestReport.period_end}`
                    : undefined
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/reports?studentId=${data.student.id}`}>
                  {ar ? "فتح تقارير الطالب" : "Open student reports"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/attendance?studentId=${data.student.id}`}>
                  {ar ? "فتح سجل الحضور" : "Open attendance"}
                </Link>
              </Button>
            </div>
          </Panel>

          <Panel
            icon={<CalendarDays />}
            title={ar ? "الحصص الأخيرة والقادمة" : "Recent and upcoming sessions"}
          >
            {data.sessions.length ? (
              <div className="grid divide-y">
                {data.sessions.slice(0, 6).map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-bold text-primary">
                        {formatDate(session.scheduled_at, locale)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {one(one(session.teacher)?.profile)?.full_name ?? "—"} ·{" "}
                        {session.duration_min} {ar ? "دقيقة" : "min"}
                      </p>
                    </div>
                    <Badge variant={session.status === "held" ? "success" : "outline"}>
                      {sessionStatus(session.status, ar)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                text={
                  ar
                    ? "لا توجد حصص بعد. أضف الجدول بعد تعيين المعلم."
                    : "No sessions yet. Add a schedule after assigning a teacher."
                }
              />
            )}
          </Panel>

          <Panel icon={<UserRoundCheck />} title={ar ? "سجل التعيينات" : "Assignment history"}>
            {data.assignments.length ? (
              <div className="grid divide-y">
                {data.assignments.map((assignment) => (
                  <div key={assignment.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-black text-primary">
                        {one(one(assignment.teacher)?.profile)?.full_name ?? "—"}
                      </p>
                      <Badge
                        variant={
                          assignment.status === "active"
                            ? "success"
                            : assignment.status === "paused"
                              ? "warning"
                              : "outline"
                        }
                      >
                        {assignmentStatus(assignment.status, ar)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {assignment.start_date}
                      {assignment.end_date ? ` — ${assignment.end_date}` : ""} · {assignment.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                text={ar ? "لم يُعيّن الطالب لمعلم بعد." : "The student has not been assigned yet."}
              />
            )}
          </Panel>
        </div>

        <aside className="grid content-start gap-6">
          <Panel icon={<Users />} title={ar ? "الأسرة" : "Family"}>
            {data.guardians.length ? (
              data.guardians.map((link, index) => {
                const guardian = one(link.guardian);
                const profile = one(guardian?.profile);
                return (
                  <div key={guardian?.id ?? index} className="border-b py-3 last:border-0">
                    <p className="font-black text-primary">{profile?.full_name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">
                      {link.relation ?? (ar ? "ولي أمر" : "Guardian")}
                      {link.is_primary ? ` · ${ar ? "أساسي" : "Primary"}` : ""}
                    </p>
                  </div>
                );
              })
            ) : (
              <Empty text={ar ? "لا يوجد ولي أمر مرتبط." : "No linked guardian."} />
            )}
          </Panel>
          <Panel icon={<BookOpenCheck />} title={ar ? "المراجعة والتقدم" : "Review and progress"}>
            <dl className="grid gap-3 text-sm">
              <Row
                label={ar ? "صفحات متقنة" : "Mastered pages"}
                value={String(data.progress.masteredPages)}
              />
              <Row
                label={ar ? "تحتاج مراجعة الآن" : "Due for review"}
                value={String(data.progress.reviewDue)}
              />
              <Row
                label={ar ? "صفحات لها سجل" : "Tracked pages"}
                value={String(data.progress.totalTracked)}
              />
            </dl>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href={`/admin/reports?studentId=${data.student.id}`}>
                {ar ? "متابعة التقارير" : "Follow reports"}
              </Link>
            </Button>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-black text-primary">
        <span className="text-secondary">{icon}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-card">
      <span className="text-secondary">{icon}</span>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-black text-primary">{value}</p>
    </article>
  );
}
function Record({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/60 p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 font-black text-primary">{primary}</p>
      {secondary ? <p className="mt-1 text-xs text-muted-foreground">{secondary}</p> : null}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">
      {text}
    </p>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-black text-primary">{value}</dd>
    </div>
  );
}
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
function formatDate(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
function studentStatus(status: string, ar: boolean) {
  const map = ar
    ? { active: "نشط", dropped: "منسحب", graduated: "متخرج", suspended: "موقوف", archived: "مؤرشف" }
    : {
        active: "Active",
        dropped: "Dropped",
        graduated: "Graduated",
        suspended: "Suspended",
        archived: "Archived",
      };
  return map[status as keyof typeof map] ?? status;
}
function subscriptionStatus(status: string, ar: boolean) {
  const map = ar
    ? {
        trial: "تجريبي",
        active: "نشط",
        paused: "متوقف مؤقتًا",
        expired: "منتهي",
        cancelled: "ملغي",
      }
    : {
        trial: "Trial",
        active: "Active",
        paused: "Paused",
        expired: "Expired",
        cancelled: "Cancelled",
      };
  return map[status as keyof typeof map] ?? status;
}
function reportStatus(status: string, ar: boolean) {
  const map = ar
    ? {
        draft: "مسودة لدى المعلم",
        approved: "بانتظار الإدارة",
        admin_review: "مُعاد للمعلم",
        visible: "منشور",
      }
    : {
        draft: "Teacher draft",
        approved: "Pending admin",
        admin_review: "Returned to teacher",
        visible: "Published",
      };
  return map[status as keyof typeof map] ?? status;
}
function assignmentStatus(status: string, ar: boolean) {
  const map = ar
    ? { active: "حالي", paused: "موقوف مؤقتًا", ended: "منتهي" }
    : { active: "Current", paused: "Paused", ended: "Ended" };
  return map[status as keyof typeof map] ?? status;
}
function sessionStatus(status: string, ar: boolean) {
  const map = ar
    ? {
        scheduled: "مجدولة",
        held: "منعقدة",
        missed: "لم تنعقد",
        cancelled: "ملغاة",
        rescheduled: "أعيدت جدولتها",
      }
    : {
        scheduled: "Scheduled",
        held: "Held",
        missed: "Missed",
        cancelled: "Cancelled",
        rescheduled: "Rescheduled",
      };
  return map[status as keyof typeof map] ?? status;
}
