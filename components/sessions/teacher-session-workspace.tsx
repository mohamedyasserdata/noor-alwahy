import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { SessionEvaluationForm } from "@/components/evaluation/session-evaluation-form";
import { TeacherPanel } from "@/components/teacher/teacher-page-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { recordAttendanceAction } from "@/lib/attendance/actions";
import type { TeacherSessionWorkspaceData } from "@/lib/sessions/workspace";
import {
  manageSessionZoomAction,
  updateTeacherSessionStateAction,
} from "@/lib/sessions/workspace-actions";

type Query = Record<string, string | string[] | undefined>;

const studentAttendance = ["present", "late", "student_absent", "student_excused"] as const;

const copy = {
  ar: {
    back: "العودة إلى الحصص والجدول",
    eyebrow: "مساحة عمل الحصة",
    title: "حصة {student}",
    groupTitle: "حصة جماعية · {count} طلاب",
    description: "الرابط والحضور والتسميع في سياق واحد مرتبط بالحصة والطالب.",
    student: "الطالب",
    participants: "المشاركون",
    teacher: "المعلم",
    date: "الموعد",
    duration: "المدة",
    kind: "نوع الحصة",
    status: "الحالة",
    minutes: "{count} دقيقة",
    scheduled: "مجدولة",
    held: "مكتملة",
    missed: "لم تتم",
    cancelled: "ملغاة",
    rescheduled: "أعيدت جدولتها",
    regular: "فردية",
    trial: "تجريبية",
    makeup: "تعويضية",
    extra: "إضافية",
    zoomTitle: "رابط Zoom للحصة",
    zoomPublished: "منشور للطالب المصرح له",
    zoomHidden: "غير منشور",
    zoomHelp:
      "يُتاح الرابط للطالب فقط داخل نافذة الانضمام المعتمدة، ولا يُستخدم رابط المعلم العام تلقائيًا.",
    zoomUrl: "رابط دخول المشارك",
    reviewPublish: "مراجعة نشر الرابط",
    reviewUnpublish: "مراجعة إلغاء النشر",
    operation: "العملية",
    result: "النتيجة",
    audience: "الجمهور",
    publish: "نشر الرابط للحصة",
    publishing: "جارٍ النشر…",
    unpublish: "إلغاء نشر الرابط",
    unpublishing: "جارٍ إلغاء النشر…",
    audienceValue: "هذا الطالب فقط",
    groupAudienceValue: "جميع الطلاب المسجلين في الحصة ({count})",
    publishResult: "سيصبح زر دخول الحصة متاحًا داخل نافذة الوقت.",
    unpublishResult: "سيتوقف الطالب عن استلام الرابط فورًا مع بقاء سجل الحصة.",
    openZoom: "فتح Zoom",
    attendanceTitle: "حضور الطالب",
    attendanceHelp: "سجّل حضور الطالب فقط. حضور المعلم تسجله الإدارة ولا يمكن تعديله من هنا.",
    groupAttendanceHelp:
      "سجّل حالة كل طالب على حدة. لا تُطبّق أي آثار مالية تلقائية على الحصة الجماعية.",
    changeAttendance: "تعديل الحضور",
    correctionReason: "سبب التعديل",
    correctionPlaceholder: "اكتب سببًا واضحًا للتعديل…",
    saveCorrection: "حفظ التعديل",
    present: "حاضر",
    late: "متأخر",
    student_absent: "غائب",
    student_excused: "غائب بعذر",
    teacher_absent: "غياب المعلم",
    cancelled_teacher: "ملغاة بسبب المعلم",
    cancelled_admin: "ملغاة من الإدارة",
    savedAttendance: "تم حفظ الحضور",
    saving: "جارٍ الحفظ…",
    reviewTitle: "المراجعة المطلوبة",
    reviewEmpty: "لا توجد صفحات مراجعة مستحقة.",
    page: "صفحة {page}",
    overdue: "متأخرة",
    stateTitle: "حالة الحصة",
    start: "بدء الحصة",
    starting: "جارٍ البدء…",
    endReview: "مراجعة إنهاء الحصة",
    end: "إنهاء الحصة",
    ending: "جارٍ الإنهاء…",
    endResult: "ستُسجل الحصة كمكتملة ويُلغى نشر رابطها، ثم يصبح التقييم متاحًا.",
    evaluationTitle: "التسميع والتقييم",
    evaluationLocked: "تم اعتماد التقييم ونشره للطالب.",
    evaluationWaitAttendance: "سجّل حضور الطالب أولًا، ثم أنهِ الحصة لفتح التقييم.",
    evaluationAbsent: "تم تسجيل الغياب؛ لا يلزم إنشاء تسميع أو درجة وهمية.",
    evaluationReady: "أكمل التقييم ثم اعتمده لينعكس على ملف الطالب وصفحة التقدم.",
    zoomSuccessPublish: "نُشر رابط الحصة بنجاح.",
    zoomSuccessUnpublish: "أُلغي نشر رابط الحصة مع الاحتفاظ به في سجلها.",
    sessionStarted: "بدأت الحصة.",
    sessionEnded: "انتهت الحصة وأصبح توثيق التقييم متاحًا.",
    evaluationSaved: "حُفظ التقييم وقُفل ونُشر للطالب.",
    evaluationDraft: "حُفظت المسودة في النظام ولن تظهر للطالب أو ولي الأمر قبل الاعتماد.",
    requestError: "تعذر تنفيذ العملية. راجع حالة الحصة وحاول مرة أخرى.",
  },
  en: {
    back: "Back to sessions & schedule",
    eyebrow: "Session workspace",
    title: "Session with {student}",
    groupTitle: "Group session · {count} students",
    description: "Meeting access, attendance, and recitation in one session-scoped workspace.",
    student: "Student",
    participants: "Participants",
    teacher: "Teacher",
    date: "Date",
    duration: "Duration",
    kind: "Session type",
    status: "Status",
    minutes: "{count} min",
    scheduled: "Scheduled",
    held: "Completed",
    missed: "Missed",
    cancelled: "Cancelled",
    rescheduled: "Rescheduled",
    regular: "Individual",
    trial: "Trial",
    makeup: "Makeup",
    extra: "Extra",
    zoomTitle: "Session Zoom link",
    zoomPublished: "Published to the authorized student",
    zoomHidden: "Not published",
    zoomHelp:
      "The student receives the link only in the approved join window. The teacher's general link is never used automatically.",
    zoomUrl: "Participant join URL",
    reviewPublish: "Review link publication",
    reviewUnpublish: "Review unpublishing",
    operation: "Operation",
    result: "Result",
    audience: "Audience",
    publish: "Publish for this session",
    publishing: "Publishing…",
    unpublish: "Unpublish link",
    unpublishing: "Unpublishing…",
    audienceValue: "This student only",
    groupAudienceValue: "All registered session students ({count})",
    publishResult: "The join button will become available inside the approved time window.",
    unpublishResult:
      "The student will immediately stop receiving the link while session history remains.",
    openZoom: "Open Zoom",
    attendanceTitle: "Student attendance",
    attendanceHelp: "Record student attendance only. Administration records teacher attendance.",
    groupAttendanceHelp:
      "Record every student independently. Group attendance does not trigger automatic financial effects.",
    changeAttendance: "Change attendance",
    correctionReason: "Correction reason",
    correctionPlaceholder: "Enter a clear reason for this correction…",
    saveCorrection: "Save correction",
    present: "Present",
    late: "Late",
    student_absent: "Absent",
    student_excused: "Excused absence",
    teacher_absent: "Teacher absent",
    cancelled_teacher: "Cancelled by teacher",
    cancelled_admin: "Cancelled by administration",
    savedAttendance: "Attendance saved",
    saving: "Saving…",
    reviewTitle: "Review queue",
    reviewEmpty: "No review pages are due.",
    page: "Page {page}",
    overdue: "Overdue",
    stateTitle: "Session state",
    start: "Start session",
    starting: "Starting…",
    endReview: "Review session completion",
    end: "End session",
    ending: "Ending…",
    endResult: "The session will be completed, its link unpublished, and evaluation enabled.",
    evaluationTitle: "Recitation and evaluation",
    evaluationLocked: "The evaluation is approved and published to the student.",
    evaluationWaitAttendance: "Record attendance, then end the session to enable evaluation.",
    evaluationAbsent: "Absence is recorded; no fake recitation or zero score is required.",
    evaluationReady:
      "Complete and approve the evaluation to update the student profile and progress page.",
    zoomSuccessPublish: "The session link was published.",
    zoomSuccessUnpublish: "The session link was unpublished while its history was retained.",
    sessionStarted: "The session started.",
    sessionEnded: "The session ended and evaluation is now available.",
    evaluationSaved: "The evaluation was saved, locked, and published to the student.",
    evaluationDraft: "The draft was saved in the system and remains hidden until approval.",
    requestError: "The operation could not be completed. Review the session state and try again.",
  },
} as const;

export function TeacherSessionWorkspace({
  data,
  locale,
  query,
}: {
  data: TeacherSessionWorkspaceData;
  locale: AppLocale;
  query: Query;
}) {
  const text = copy[locale];
  const session = data.session;
  const isGroup = session.format === "group";
  const audience = isGroup
    ? format(text.groupAudienceValue, { count: session.participants.length })
    : text.audienceValue;
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: session.student.timezone,
  });
  const attendance = session.attendance?.status;
  const isAbsent = attendance === "student_absent" || attendance === "student_excused";
  const success =
    query.zoomStatus === "publish"
      ? text.zoomSuccessPublish
      : query.zoomStatus === "unpublish"
        ? text.zoomSuccessUnpublish
        : query.sessionStatus === "start"
          ? text.sessionStarted
          : query.sessionStatus === "end"
            ? text.sessionEnded
            : query.attendanceStatus === "saved"
              ? text.savedAttendance
              : query.evaluationStatus === "saved"
                ? text.evaluationSaved
                : query.evaluationStatus === "draft"
                  ? text.evaluationDraft
                  : null;
  const error =
    query.zoomError || query.sessionError || query.attendanceError || query.evaluationError;

  return (
    <section
      className="teacher-reference-page"
      aria-labelledby="session-workspace-title"
      data-testid="teacher-session-workspace"
    >
      <Button asChild variant="ghost" size="sm" className="mb-3 px-0 hover:bg-transparent">
        <Link href="/teacher/schedule">
          {locale === "ar" ? <ArrowRight /> : <ArrowLeft />}
          {text.back}
        </Link>
      </Button>
      <header className="rounded-2xl border border-secondary/25 bg-card p-5 shadow-card sm:p-6">
        <p className="text-sm font-black text-secondary">{text.eyebrow}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1
              id="session-workspace-title"
              className="text-2xl font-black text-primary sm:text-3xl"
            >
              {isGroup
                ? format(text.groupTitle, { count: session.participants.length })
                : format(text.title, { student: session.student.name })}
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{text.description}</p>
          </div>
          <Badge variant={session.status === "held" ? "success" : "secondary"}>
            {text[session.status]}
          </Badge>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-secondary/15 pt-5 sm:grid-cols-2 xl:grid-cols-5">
          <Fact
            label={isGroup ? text.participants : text.student}
            value={
              isGroup
                ? session.participants.map((participant) => participant.name).join("، ")
                : `${session.student.name} · ${session.student.number}`
            }
          />
          <Fact label={text.teacher} value={session.teacherName} />
          <Fact label={text.date} value={dateTime.format(new Date(session.scheduledAt))} />
          <Fact
            label={text.duration}
            value={format(text.minutes, { count: session.durationMin })}
          />
          <Fact label={text.kind} value={text[session.kind]} />
        </dl>
      </header>

      {success ? (
        <Alert className="mt-4" variant="success">
          {success}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-4" variant="warning">
          {text.requestError}
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <TeacherPanel
          title={text.zoomTitle}
          action={
            <Badge variant={data.zoom.is_published ? "success" : "outline"}>
              {data.zoom.is_published ? text.zoomPublished : text.zoomHidden}
            </Badge>
          }
        >
          <p className="text-sm leading-6 text-muted-foreground">{text.zoomHelp}</p>
          {data.zoom.is_published && data.zoom.join_url ? (
            <Button asChild className="mt-4" variant="outline">
              <a href={data.zoom.join_url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                {text.openZoom}
              </a>
            </Button>
          ) : null}
          {session.status === "scheduled" ? (
            <div className="mt-4 grid gap-3">
              <details className="rounded-xl border border-secondary/25 bg-background/55 p-3">
                <summary className="cursor-pointer font-black text-primary">
                  {text.reviewPublish}
                </summary>
                <form
                  action={manageSessionZoomAction.bind(null, locale)}
                  className="mt-4 grid gap-3"
                >
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="action" value="publish" />
                  <Label htmlFor="session-zoom-url">{text.zoomUrl}</Label>
                  <Input
                    id="session-zoom-url"
                    name="joinUrl"
                    type="url"
                    inputMode="url"
                    defaultValue={data.zoom.join_url ?? ""}
                    placeholder="https://zoom.us/j/…"
                    required
                  />
                  <ReviewFacts
                    operation={text.publish}
                    result={text.publishResult}
                    audience={audience}
                    text={text}
                  />
                  <AdminSubmitButton label={text.publish} pendingLabel={text.publishing} />
                </form>
              </details>
              {data.zoom.is_published ? (
                <details className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                  <summary className="cursor-pointer font-black text-destructive">
                    {text.reviewUnpublish}
                  </summary>
                  <form
                    action={manageSessionZoomAction.bind(null, locale)}
                    className="mt-4 grid gap-3"
                  >
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="action" value="unpublish" />
                    <input type="hidden" name="joinUrl" value="" />
                    <ReviewFacts
                      operation={text.unpublish}
                      result={text.unpublishResult}
                      audience={audience}
                      text={text}
                    />
                    <AdminSubmitButton
                      label={text.unpublish}
                      pendingLabel={text.unpublishing}
                      variant="destructive"
                    />
                  </form>
                </details>
              ) : null}
            </div>
          ) : null}
        </TeacherPanel>

        <TeacherPanel
          title={text.stateTitle}
          action={<Clock3 className="size-5 text-secondary" aria-hidden="true" />}
        >
          <div className="flex flex-wrap gap-2">
            {session.status === "scheduled" && !session.startedAt ? (
              <form action={updateTeacherSessionStateAction.bind(null, locale)}>
                <input type="hidden" name="sessionId" value={session.id} />
                <input type="hidden" name="action" value="start" />
                <AdminSubmitButton label={text.start} pendingLabel={text.starting} />
              </form>
            ) : null}
            {session.status === "scheduled" ? (
              <details className="w-full rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <summary className="cursor-pointer font-black text-destructive">
                  {text.endReview}
                </summary>
                <form
                  action={updateTeacherSessionStateAction.bind(null, locale)}
                  className="mt-3 grid gap-3"
                >
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="action" value="end" />
                  <ReviewFacts
                    operation={text.end}
                    result={text.endResult}
                    audience={audience}
                    text={text}
                  />
                  <AdminSubmitButton
                    label={text.end}
                    pendingLabel={text.ending}
                    variant="destructive"
                  />
                </form>
              </details>
            ) : (
              <p className="text-sm text-muted-foreground">{text[session.status]}</p>
            )}
          </div>
        </TeacherPanel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <TeacherPanel
          title={text.attendanceTitle}
          action={<UserRoundCheck className="size-5 text-secondary" aria-hidden="true" />}
        >
          <p className="text-sm leading-6 text-muted-foreground">
            {isGroup ? text.groupAttendanceHelp : text.attendanceHelp}
          </p>
          <div className={isGroup ? "mt-4 grid gap-3 sm:grid-cols-2" : "mt-4"}>
            {(isGroup
              ? session.participants
              : [
                  {
                    id: session.studentId,
                    name: session.student.name,
                    number: session.student.number,
                    isPrimary: true,
                    timezone: session.student.timezone,
                  },
                ]
            ).map((participant) => {
              const participantAttendance = session.attendances.find(
                (item) => item.student_id === participant.id,
              );
              return (
                <AttendanceControls
                  key={participant.id}
                  locale={locale}
                  sessionId={session.id}
                  studentId={participant.id}
                  studentName={participant.name}
                  attendance={participantAttendance?.status}
                  text={text}
                  showName={isGroup}
                />
              );
            })}
          </div>
        </TeacherPanel>
        <TeacherPanel
          title={text.reviewTitle}
          action={<BookOpenCheck className="size-5 text-secondary" aria-hidden="true" />}
        >
          {data.reviewQueue.length ? (
            <ul className="flex flex-wrap gap-2">
              {data.reviewQueue.map((item) => (
                <li key={item.page}>
                  <Badge variant={item.is_overdue ? "warning" : "outline"}>
                    {format(text.page, { page: item.page })}
                    {item.is_overdue ? ` · ${text.overdue}` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{text.reviewEmpty}</p>
          )}
        </TeacherPanel>
      </div>

      <div className="mt-4">
        <TeacherPanel
          title={text.evaluationTitle}
          action={
            session.evaluation?.is_locked ? (
              <Badge variant="success">
                <ShieldCheck aria-hidden="true" />
                {text.held}
              </Badge>
            ) : (
              <ClipboardState />
            )
          }
        >
          {session.evaluation?.is_locked ? (
            <div className="rounded-xl bg-success/8 p-4">
              <p className="font-black text-success">{text.evaluationLocked}</p>
              <p className="mt-1 text-2xl font-black text-primary tabular-nums">
                {Math.round(Number(session.evaluation.total_score))}%
              </p>
            </div>
          ) : isAbsent ? (
            <Alert variant="warning">{text.evaluationAbsent}</Alert>
          ) : data.evaluationForm ? (
            <div>
              <p className="mb-5 text-sm leading-6 text-muted-foreground">{text.evaluationReady}</p>
              <SessionEvaluationForm
                locale={locale}
                sessionId={session.id}
                settings={data.evaluationForm.settings}
                surahs={data.evaluationForm.surahs}
                clearSavedDraft={query.evaluationStatus === "saved"}
                returnToSession
                initialDraft={
                  data.evaluationForm.sessions.find((item) => item.id === session.id)?.evaluation
                    ?.draft
                }
              />
            </div>
          ) : (
            <Alert>{text.evaluationWaitAttendance}</Alert>
          )}
        </TeacherPanel>
      </div>
    </section>
  );
}

function AttendanceControls({
  locale,
  sessionId,
  studentId,
  studentName,
  attendance,
  text,
  showName,
}: {
  locale: AppLocale;
  sessionId: string;
  studentId: string;
  studentName: string;
  attendance?: string;
  text: (typeof copy)[AppLocale];
  showName: boolean;
}) {
  return (
    <section
      className="rounded-xl border border-secondary/20 bg-background/55 p-3"
      data-testid={`student-attendance-${studentId}`}
    >
      {showName ? <h3 className="font-black text-primary">{studentName}</h3> : null}
      {attendance ? (
        <div className={showName ? "mt-2" : ""}>
          <div className="flex items-center gap-2 rounded-lg bg-success/8 p-3">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            <Badge variant="success">{text[attendance as keyof typeof text] as string}</Badge>
          </div>
          <details className="mt-2 rounded-lg border border-secondary/20 p-3">
            <summary className="cursor-pointer text-sm font-black text-primary">
              {text.changeAttendance}
            </summary>
            <form action={recordAttendanceAction.bind(null, locale)} className="mt-3 grid gap-3">
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="studentId" value={studentId} />
              <input type="hidden" name="returnToSession" value="true" />
              <Label htmlFor={`attendance-status-${studentId}`}>{text.attendanceTitle}</Label>
              <select
                id={`attendance-status-${studentId}`}
                name="status"
                defaultValue={attendance}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
              >
                {studentAttendance.map((status) => (
                  <option key={status} value={status}>
                    {text[status]}
                  </option>
                ))}
              </select>
              <Label htmlFor={`attendance-reason-${studentId}`}>{text.correctionReason}</Label>
              <Input
                id={`attendance-reason-${studentId}`}
                name="correctionReason"
                placeholder={text.correctionPlaceholder}
                minLength={2}
                maxLength={1000}
                required
              />
              <AdminSubmitButton label={text.saveCorrection} pendingLabel={text.saving} />
            </form>
          </details>
        </div>
      ) : (
        <div className={`${showName ? "mt-3" : ""} flex flex-wrap gap-2`}>
          {studentAttendance.map((status) => (
            <form key={status} action={recordAttendanceAction.bind(null, locale)}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="studentId" value={studentId} />
              <input type="hidden" name="returnToSession" value="true" />
              <input type="hidden" name="status" value={status} />
              <AdminSubmitButton
                label={text[status]}
                pendingLabel={text.saving}
                variant={
                  status === "student_absent"
                    ? "destructive"
                    : status === "student_excused"
                      ? "outline"
                      : "gold"
                }
              />
            </form>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewFacts({
  operation,
  result,
  audience,
  text,
}: {
  operation: string;
  result: string;
  audience: string;
  text: (typeof copy)[AppLocale];
}) {
  return (
    <dl className="grid gap-2 rounded-xl bg-muted/55 p-3 text-sm">
      <Fact label={text.operation} value={operation} />
      <Fact label={text.result} value={result} />
      <Fact label={text.audience} value={audience} />
    </dl>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-black text-foreground">{value}</dd>
    </div>
  );
}
function ClipboardState() {
  return (
    <span className="grid size-9 place-items-center rounded-full bg-secondary/12 text-secondary">
      <CalendarClock className="size-4" aria-hidden="true" />
    </span>
  );
}
function format(value: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)),
    value,
  );
}
