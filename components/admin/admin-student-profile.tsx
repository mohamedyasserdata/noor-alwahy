import {
  ArrowLeft,
  Award,
  BookOpenCheck,
  ChartNoAxesCombined,
  ClipboardCheck,
  CreditCard,
  Download,
  GraduationCap,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { QuranBaselineForm } from "@/components/quran/quran-baseline-form";
import { WeeklyScheduleGrid } from "@/components/schedule/weekly-schedule-grid";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { getAdminStudentProfile } from "@/lib/admin/student-profile";
import {
  revokeStudentCertificateAction,
  uploadStudentCertificateAction,
} from "@/lib/certificates/actions";
import { reviewSessionZoomAction } from "@/lib/admin/session-zoom-actions";

type Data = NonNullable<Awaited<ReturnType<typeof getAdminStudentProfile>>>;

export function AdminStudentProfile({
  locale,
  data,
  query,
}: {
  locale: AppLocale;
  data: Data;
  query: Record<string, string | string[] | undefined>;
}) {
  const ar = locale === "ar";
  const currentTeacher = data.currentAssignment
    ? one(data.currentAssignment.teacher)?.profile
    : null;
  const teacherProfile = one(currentTeacher);
  const latestReport = data.reports[0];
  const latestEvaluation = data.evaluations[0];
  const subscription = data.subscriptions[0];
  const pendingZoomSessions = data.sessions.filter(
    (session) => session.zoom_review_status === "pending" && session.zoom_override_url,
  );
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

      {typeof query.certificateStatus === "string" ? (
        <Alert className="mt-5" variant="success">
          {query.certificateStatus === "revoked"
            ? ar
              ? "تم سحب الشهادة، ولم تعد متاحة للطالب."
              : "Certificate withdrawn and no longer available to the student."
            : ar
              ? "تم رفع الشهادة وأصبحت متاحة للطالب."
              : "Certificate uploaded and is now available to the student."}
        </Alert>
      ) : null}
      {typeof query.certificateError === "string" ? (
        <Alert className="mt-5" variant="warning">
          {query.certificateError === "invalid_file"
            ? ar
              ? "اختر ملف PDF صالحًا لا يزيد على 10 ميجابايت، ثم حاول مرة أخرى."
              : "Choose a valid PDF up to 10 MB, then try again."
            : ar
              ? "تعذر حفظ الشهادة. لم يُضف أي سجل جزئي؛ حاول مرة أخرى."
              : "The certificate could not be saved. No partial record was kept; try again."}
        </Alert>
      ) : null}
      {typeof query.zoomStatus === "string" ? (
        <Alert className="mt-5" variant="success">
          {query.zoomStatus === "approve"
            ? ar
              ? "تم اعتماد رابط الحصة وإتاحته داخل نافذة الانضمام."
              : "Session link approved."
            : ar
              ? "أُعيد الرابط للمدرس لتعديله."
              : "Session link returned to the teacher."}
        </Alert>
      ) : null}
      {typeof query.zoomError === "string" ? (
        <Alert className="mt-5" variant="warning">
          {ar
            ? "تعذر مراجعة الرابط. حدّث الصفحة وحاول مرة أخرى."
            : "The link could not be reviewed."}
        </Alert>
      ) : null}
      {typeof query.baselineStatus === "string" ? (
        <Alert className="mt-5" variant="success">
          {ar
            ? "تم حفظ خط البداية القرآني للطالب."
            : "The student's Quran starting point was saved."}
        </Alert>
      ) : null}
      {typeof query.baselineError === "string" ? (
        <Alert className="mt-5" variant="warning">
          {ar
            ? "تعذر حفظ نقطة البداية. راجع نطاق الصفحات والحقول ثم حاول مرة أخرى."
            : "The starting point could not be saved. Review the page range and try again."}
        </Alert>
      ) : null}

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

      <div className="mt-6">
        <QuranBaselineForm
          locale={locale}
          studentId={data.student.id}
          role="admin"
          surahs={data.quranLocations}
          baseline={data.quranBaseline}
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
            icon={<ClipboardCheck />}
            title={ar ? "مراجعة روابط الحصص" : "Session link review"}
          >
            {pendingZoomSessions.length ? (
              <div className="grid gap-3">
                {pendingZoomSessions.map((session) => {
                  const teacher = one(session.teacher);
                  const profile = teacher ? one(teacher.profile) : null;
                  return (
                    <article key={session.id} className="rounded-2xl border bg-background/55 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-primary">
                            {ar ? "رابط حصة ينتظر الاعتماد" : "Session link awaiting approval"}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(session.scheduled_at, locale)} · {profile?.full_name ?? "—"}
                          </p>
                        </div>
                        <Badge variant="warning">{ar ? "بانتظار الإدارة" : "Pending"}</Badge>
                      </div>
                      <a
                        href={session.zoom_override_url!}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block truncate rounded-xl border bg-card px-3 py-2 text-sm font-bold text-primary underline-offset-4 hover:underline"
                        dir="ltr"
                      >
                        {session.zoom_override_url}
                      </a>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <form action={reviewSessionZoomAction.bind(null, locale)}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="studentId" value={data.student.id} />
                          <input type="hidden" name="action" value="approve" />
                          <AdminSubmitButton
                            label={ar ? "اعتماد الرابط" : "Approve link"}
                            pendingLabel={ar ? "جارٍ الاعتماد…" : "Approving…"}
                          />
                        </form>
                        <form action={reviewSessionZoomAction.bind(null, locale)}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="studentId" value={data.student.id} />
                          <input type="hidden" name="action" value="reject" />
                          <AdminSubmitButton
                            variant="destructive"
                            label={ar ? "إعادة للمدرس" : "Return to teacher"}
                            pendingLabel={ar ? "جارٍ الإرجاع…" : "Returning…"}
                          />
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {ar ? "لا توجد روابط حصص تنتظر المراجعة." : "No session links await review."}
              </p>
            )}
          </Panel>

          <WeeklyScheduleGrid
            slots={data.scheduleSlots}
            locale={locale}
            role="student"
            timezone="Africa/Cairo"
            variant="compact"
            labels={{
              title: ar ? "الجدول الأسبوعي للطالب" : "Student weekly schedule",
              description: ar
                ? "يعرض المعلم وموعد كل حصة، ويتحدث تلقائيًا عند تعديل الجدول أو التعيين."
                : "Shows each lesson and teacher and updates automatically when the schedule changes.",
              lessonCount: ar ? "{count} موعد أسبوعي" : "{count} weekly lessons",
              lessonsAtTime: ar ? "{count} حصص" : "{count} lessons",
              student: ar ? "الطالب" : "Student",
              teacher: ar ? "المعلم" : "Teacher",
              empty: ar
                ? "لا توجد مواعيد أسبوعية لهذا الطالب. ستظهر هنا فور إضافتها أو تعديلها."
                : "This student has no weekly appointments. New or updated times will appear here automatically.",
              weekdays: ar
                ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
                : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            }}
          />

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

          <Panel icon={<Award />} title={ar ? "شهادات الطالب" : "Student certificates"}>
            <form
              action={uploadStudentCertificateAction.bind(null, locale, data.student.id)}
              className="grid gap-4 rounded-2xl border border-secondary/20 bg-background/55 p-4 sm:grid-cols-2"
            >
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="certificate-title">
                  {ar ? "اسم الشهادة أو الإنجاز" : "Certificate or achievement name"}
                </Label>
                <Input
                  id="certificate-title"
                  name="title"
                  required
                  minLength={2}
                  maxLength={180}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="certificate-date">
                  {ar ? "تاريخ الإصدار (اختياري)" : "Issue date (optional)"}
                </Label>
                <Input
                  id="certificate-date"
                  name="issuedOn"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="certificate-file">{ar ? "ملف PDF" : "PDF file"}</Label>
                <Input
                  id="certificate-file"
                  name="certificate"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                {ar
                  ? "PDF فقط، بحد أقصى 10 ميجابايت. ستظهر الشهادة في حساب هذا الطالب بعد الحفظ."
                  : "PDF only, up to 10 MB. The certificate will appear in this student's account after saving."}
              </p>
              <div className="sm:col-span-2">
                <AdminSubmitButton
                  label={ar ? "رفع الشهادة للطالب" : "Upload certificate"}
                  pendingLabel={ar ? "جارٍ رفع الشهادة…" : "Uploading certificate…"}
                />
              </div>
            </form>

            <div className="mt-5 grid gap-3">
              {data.certificates.length ? (
                data.certificates.map((certificate) => (
                  <article
                    key={certificate.id}
                    className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-primary">
                          {certificate.title ?? (ar ? "شهادة سابقة" : "Legacy certificate")}
                        </h3>
                        <Badge variant={certificate.revoked_at ? "destructive" : "success"}>
                          {certificate.revoked_at
                            ? ar
                              ? "مسحوبة"
                              : "Withdrawn"
                            : ar
                              ? "متاحة للطالب"
                              : "Visible to student"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm break-words text-muted-foreground">
                        <bdi>{certificate.serial_no}</bdi> ·{" "}
                        {formatDate(certificate.issued_at, locale)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!certificate.revoked_at ? (
                        <>
                          <Button asChild variant="outline" size="sm">
                            <a href={`/api/pdf/certificates/${certificate.id}`}>
                              <Download aria-hidden="true" />
                              {ar ? "تنزيل" : "Download"}
                            </a>
                          </Button>
                          <details className="rounded-lg border border-destructive/30">
                            <summary className="flex min-h-9 cursor-pointer items-center px-3 text-sm font-bold text-destructive">
                              {ar ? "مراجعة السحب" : "Review withdrawal"}
                            </summary>
                            <form
                              action={revokeStudentCertificateAction.bind(
                                null,
                                locale,
                                data.student.id,
                              )}
                              className="grid w-72 gap-3 border-t p-3"
                            >
                              <input type="hidden" name="certificateId" value={certificate.id} />
                              <p className="text-xs leading-5 text-muted-foreground">
                                {ar
                                  ? `سيُمنع الطالب من تنزيل «${certificate.title ?? "الشهادة"}» بعد التأكيد.`
                                  : "The student will no longer be able to download this certificate after confirmation."}
                              </p>
                              <Label htmlFor={`certificate-reason-${certificate.id}`}>
                                {ar ? "سبب السحب" : "Withdrawal reason"}
                              </Label>
                              <Input
                                id={`certificate-reason-${certificate.id}`}
                                name="reason"
                                required
                                minLength={5}
                                maxLength={500}
                              />
                              <AdminSubmitButton
                                variant="destructive"
                                label={ar ? "تأكيد سحب الشهادة" : "Confirm withdrawal"}
                                pendingLabel={ar ? "جارٍ السحب…" : "Withdrawing…"}
                              />
                            </form>
                          </details>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <Empty
                  text={
                    ar
                      ? "لم تُرفع شهادة لهذا الطالب بعد."
                      : "No certificate has been uploaded for this student yet."
                  }
                />
              )}
            </div>
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
