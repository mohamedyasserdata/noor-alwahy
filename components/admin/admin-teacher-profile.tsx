import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { getAdminTeacherProfile } from "@/lib/admin/teacher-profile";

type Data = NonNullable<Awaited<ReturnType<typeof getAdminTeacherProfile>>>;

export function AdminTeacherProfile({ locale, data }: { locale: AppLocale; data: Data }) {
  const ar = locale === "ar";
  const profile = one(data.teacher.profile);
  const pendingReports = data.reports.filter((item) => item.status === "approved").length;
  return (
    <section
      className="mx-auto w-full max-w-7xl"
      aria-labelledby="teacher-profile-title"
      data-testid="admin-teacher-profile"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/teachers">
            <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
            {ar ? "العودة إلى دليل المعلمين" : "Back to teacher directory"}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/schedule?teacherId=${data.teacher.id}`}>
              {ar ? "جدول المعلم" : "Teacher schedule"}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/attendance?teacherId=${data.teacher.id}`}>
              {ar ? "حضور المعلم" : "Teacher attendance"}
            </Link>
          </Button>
        </div>
      </div>
      <header className="mt-5 rounded-3xl border border-secondary/25 bg-card p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black text-secondary">
              {ar ? "ملف المعلم الإداري" : "Administrative teacher profile"}
            </p>
            <h1
              id="teacher-profile-title"
              className="mt-2 text-3xl font-black text-primary sm:text-4xl"
            >
              {profile?.full_name ?? "—"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {data.teacher.specialization ?? (ar ? "التخصص غير محدد" : "No specialization")} ·{" "}
              {profile?.timezone}
            </p>
          </div>
          <Badge variant={data.teacher.status === "active" ? "success" : "outline"}>
            {teacherStatus(data.teacher.status, ar)}
          </Badge>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          icon={<Users />}
          label={ar ? "الطلاب الحاليون" : "Current students"}
          value={`${data.currentAssignments.length}/${data.teacher.max_students}`}
        />
        <Summary
          icon={<Clock3 />}
          label={ar ? "نسبة حضور المعلم" : "Teacher attendance"}
          value={
            data.attendance.rate === null
              ? ar
                ? "لا توجد سجلات"
                : "No records"
              : `${data.attendance.rate}%`
          }
        />
        <Summary
          icon={<CalendarDays />}
          label={ar ? "الحصص المسجلة" : "Recorded sessions"}
          value={String(data.sessions.length)}
        />
        <Summary
          icon={<ClipboardCheck />}
          label={ar ? "تقارير تنتظر الإدارة" : "Reports pending admin"}
          value={String(pendingReports)}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="grid gap-6">
          <Panel icon={<Users />} title={ar ? "الطلاب المعيّنون" : "Assigned students"}>
            {data.currentAssignments.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.currentAssignments.map((assignment) => {
                  const student = one(assignment.student);
                  const level = one(student?.level);
                  return (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border bg-background/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-primary">{student?.full_name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            <bdi>{student?.student_no}</bdi>
                            {level
                              ? ` · ${ar ? level.name_ar : (level.name_en ?? level.name_ar)}`
                              : ""}
                          </p>
                        </div>
                        <Badge variant={assignment.status === "active" ? "success" : "warning"}>
                          {assignment.status === "active"
                            ? ar
                              ? "نشط"
                              : "Active"
                            : ar
                              ? "موقوف"
                              : "Paused"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <Link href={`/admin/students/${assignment.student_id}`}>
                            {ar ? "ملف الطالب" : "Student profile"}
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/admin/assignments?studentId=${assignment.student_id}&trackId=${assignment.track_id}`}
                          >
                            {ar ? "نقل أو تعديل" : "Move or change"}
                          </Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty
                text={
                  ar
                    ? "لا يوجد طلاب معيّنون حاليًا. استخدم التعيينات الذكية لإضافة طالب."
                    : "No assigned students. Use smart assignments to add one."
                }
              />
            )}
          </Panel>
          <Panel
            icon={<CalendarDays />}
            title={ar ? "الحصص الأخيرة والقادمة" : "Recent and upcoming sessions"}
          >
            {data.sessions.length ? (
              <div className="grid divide-y">
                {data.sessions.slice(0, 8).map((session) => {
                  const student = one(session.student);
                  return (
                    <div
                      key={session.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-black text-primary">{student?.full_name ?? "—"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(session.scheduled_at, locale)} · {session.duration_min}{" "}
                          {ar ? "دقيقة" : "min"}
                        </p>
                      </div>
                      <Badge variant={session.status === "held" ? "success" : "outline"}>
                        {sessionStatus(session.status, ar)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                text={
                  ar ? "لا توجد حصص مرتبطة بهذا المعلم." : "No sessions are linked to this teacher."
                }
              />
            )}
          </Panel>
          <Panel icon={<UserRoundCheck />} title={ar ? "سجل التعيينات" : "Assignment history"}>
            {data.assignments.length ? (
              <div className="grid divide-y">
                {data.assignments.map((assignment) => (
                  <div key={assignment.id} className="py-3">
                    <div className="flex flex-wrap justify-between gap-3">
                      <p className="font-black text-primary">
                        {one(assignment.student)?.full_name}
                      </p>
                      <Badge variant={assignment.status === "active" ? "success" : "outline"}>
                        {assignment.status}
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
              <Empty text={ar ? "لا يوجد سجل تعيينات بعد." : "No assignment history yet."} />
            )}
          </Panel>
        </div>
        <aside className="grid content-start gap-6">
          <Panel
            icon={<GraduationCap />}
            title={ar ? "المسارات والتوفر" : "Tracks and availability"}
          >
            <div className="flex flex-wrap gap-2">
              {data.teacher.teacher_tracks.map((link) => {
                const track = one(link.track);
                return (
                  <Badge key={link.track_id} variant="secondary">
                    {track ? (ar ? track.name_ar : (track.name_en ?? track.name_ar)) : "—"}
                  </Badge>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2">
              {data.teacher.teacher_availability.length ? (
                data.teacher.teacher_availability.map((slot) => (
                  <div key={slot.id} className="rounded-xl border p-3 text-sm">
                    <bdi>{weekday(slot.weekday, ar)}</bdi> ·{" "}
                    <bdi>
                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                    </bdi>
                    <Badge
                      className="ms-2"
                      variant={slot.status === "approved" ? "success" : "outline"}
                    >
                      {slot.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <Empty text={ar ? "لا توجد أوقات توفر." : "No availability slots."} />
              )}
            </div>
          </Panel>
          <Panel icon={<ClipboardCheck />} title={ar ? "التقارير" : "Reports"}>
            <p className="text-sm leading-6 text-muted-foreground">
              {ar
                ? `${data.reports.length} تقريرًا حديثًا، منها ${pendingReports} ينتظر مراجعة الإدارة.`
                : `${data.reports.length} recent reports; ${pendingReports} await admin review.`}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href={`/admin/reports?teacherId=${data.teacher.id}`}>
                {ar ? "فتح تقارير المعلم" : "Open teacher reports"}
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
      <p className="mt-1 text-xl font-black text-primary">{value}</p>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">
      {text}
    </p>
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
function weekday(value: number, ar: boolean) {
  const days = ar
    ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[value] ?? String(value);
}
function teacherStatus(status: string, ar: boolean) {
  const map = ar
    ? { pending: "بانتظار التفعيل", active: "نشط", on_leave: "في إجازة", inactive: "غير نشط" }
    : { pending: "Pending", active: "Active", on_leave: "On leave", inactive: "Inactive" };
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
