import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardCheck,
  MessageSquareText,
  NotebookTabs,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { getTeacherReportCopy, ReportForm } from "@/components/reports/teacher-reports-section";
import { TeacherMetricCard, TeacherPanel } from "@/components/teacher/teacher-page-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { saveMemorizationPlanAction } from "@/lib/memorization-plans/actions";
import { approveReportAction } from "@/lib/reports/actions";
import type { getTeacherReportsData } from "@/lib/reports/queries";
import { saveTeacherStudentNoteAction } from "@/lib/teacher/student-notes-actions";
import type { TeacherStudent360Data } from "@/lib/teacher/students";

const tabs = ["overview", "sessions", "plan", "evaluations", "reports", "notes"] as const;
export type StudentProfileTab = (typeof tabs)[number];

const copy = {
  ar: {
    back: "العودة إلى طلابي",
    overview: "نظرة عامة",
    sessions: "الحصص والحضور",
    plan: "خطة الحفظ",
    evaluations: "التقييمات والتسميع",
    reports: "التقارير",
    notes: "الملاحظات",
    assignedTeacher: "المعلم المسؤول",
    status: "حالة الطالب",
    joined: "تاريخ الانضمام",
    timezone: "المنطقة الزمنية",
    active: "نشط",
    suspended: "موقوف",
    graduated: "متخرج",
    dropped: "منسحب",
    archived: "مؤرشف",
    mastered: "صفحات متقنة",
    adherence: "تحقيق الخطة الأسبوعية",
    review: "تحتاج مراجعة",
    latestScore: "آخر تقييم",
    noData: "غير متاح بعد",
    nextSession: "الحصة القادمة",
    urgent: "المهام الحالية",
    noUrgent: "لا توجد مهام عاجلة لهذا الطالب.",
    pendingEvaluation: "تقييم حصة مكتملة لم يُقفل بعد.",
    reviewDue: "صفحات مراجعة مستحقة",
    openSchedule: "فتح الجدول",
    openEvaluation: "فتح التقييمات",
    editPlan: "تحديث الخطة",
    date: "الموعد",
    kind: "النوع",
    sessionStatus: "حالة الحصة",
    attendance: "الحضور",
    duration: "المدة",
    score: "التقييم",
    noSessions: "لا توجد حصص مسجلة لهذا الطالب.",
    minutes: "{count} دقيقة",
    weekly: "هدف أسبوعي (صفحات)",
    monthly: "هدف شهري (صفحات)",
    starts: "تبدأ في",
    ends: "تنتهي في",
    optional: "اختياري",
    save: "حفظ الخطة",
    saving: "جارٍ الحفظ…",
    actualWeekly: "الإنجاز الأسبوعي",
    actualMonthly: "الإنجاز الشهري",
    planMissing: "لم تُعد خطة الحفظ بعد. أدخل الأهداف لحفظها في النظام.",
    recitationType: "نوع التسميع",
    range: "النطاق",
    decision: "القرار",
    teacherNote: "ملاحظة الطالب/الأسرة",
    noEvaluations: "لا يوجد تقييم مقفل لهذا الطالب بعد.",
    pendingEvaluations: "تقييمات تحتاج إكمالًا",
    lockedEvaluations: "سجل التقييمات المعتمدة",
    openSessionEvaluation: "فتح الحصة وإكمال التقييم",
    page: "صفحة",
    to: "إلى",
    weakTags: "مواضع تحتاج متابعة",
    period: "الفترة",
    reportStatus: "الحالة",
    updated: "آخر تحديث",
    noReports: "لا توجد تقارير لهذا الطالب.",
    openReports: "إدارة التقارير",
    allReports: "مركز التقارير العام",
    newReport: "إنشاء تقرير لهذا الطالب",
    editReport: "مراجعة وتعديل التقرير",
    approveReport: "إرسال التقرير إلى الإدارة",
    approvingReport: "جارٍ الإرسال…",
    reportSaved: "حُفظ التقرير داخل ملف الطالب.",
    reportError: "تعذر حفظ التقرير. راجع الفترة والحقول ثم حاول مرة أخرى.",
    publishedNotes: "ملاحظات مسموح بعرضها للطالب",
    internalNotes: "الملاحظات الداخلية",
    internalExplanation: "هذه الملاحظات داخلية للمعلم والإدارة ولا تظهر للطالب أو ولي الأمر.",
    sharedAdminNotes: "معلومات شاركتها الإدارة مع المعلم",
    healthNotes: "ملاحظات صحية",
    specialNotes: "ملاحظات خاصة بالتعلم",
    addInternalNote: "إضافة ملاحظة داخلية",
    notePlaceholder: "اكتب ملاحظة تعليمية مفيدة للمتابعة…",
    saveNote: "حفظ الملاحظة",
    savingNote: "جارٍ الحفظ…",
    noteSaved: "حُفظت الملاحظة داخل ملف الطالب ولن تظهر للطالب أو الأسرة.",
    noteError: "تعذر حفظ الملاحظة. راجع النص وحاول مرة أخرى.",
    noInternalNotes: "لا توجد ملاحظات داخلية سجلها المعلم بعد.",
    noPublishedNotes: "لا توجد ملاحظات منشورة ضمن التقييمات المقفلة.",
    visibleToStudent: "مرئية للطالب والأسرة",
    planSaved: "حُفظت خطة الحفظ وتحدّثت مؤشرات الإنجاز.",
    planError: "تعذر حفظ الخطة. راجع الأهداف والتواريخ ثم حاول مرة أخرى.",
  },
  en: {
    back: "Back to my students",
    overview: "Overview",
    sessions: "Sessions & attendance",
    plan: "Memorization plan",
    evaluations: "Evaluations & recitation",
    reports: "Reports",
    notes: "Notes",
    assignedTeacher: "Assigned teacher",
    status: "Student status",
    joined: "Joined",
    timezone: "Time zone",
    active: "Active",
    suspended: "Suspended",
    graduated: "Graduated",
    dropped: "Dropped",
    archived: "Archived",
    mastered: "Mastered pages",
    adherence: "Weekly plan achievement",
    review: "Need review",
    latestScore: "Latest evaluation",
    noData: "Not available yet",
    nextSession: "Next session",
    urgent: "Current tasks",
    noUrgent: "No urgent tasks for this student.",
    pendingEvaluation: "A completed session still needs a locked evaluation.",
    reviewDue: "Review pages are due",
    openSchedule: "Open schedule",
    openEvaluation: "Open evaluations",
    editPlan: "Update plan",
    date: "Date",
    kind: "Type",
    sessionStatus: "Session status",
    attendance: "Attendance",
    duration: "Duration",
    score: "Score",
    noSessions: "No sessions are recorded for this student.",
    minutes: "{count} min",
    weekly: "Weekly target (pages)",
    monthly: "Monthly target (pages)",
    starts: "Starts on",
    ends: "Ends on",
    optional: "Optional",
    save: "Save plan",
    saving: "Saving…",
    actualWeekly: "Weekly achievement",
    actualMonthly: "Monthly achievement",
    planMissing: "No memorization plan is configured. Enter targets to save one.",
    recitationType: "Recitation type",
    range: "Range",
    decision: "Decision",
    teacherNote: "Student/family note",
    noEvaluations: "No locked evaluation exists for this student yet.",
    pendingEvaluations: "Evaluations to complete",
    lockedEvaluations: "Approved evaluation history",
    openSessionEvaluation: "Open session & complete evaluation",
    page: "Page",
    to: "to",
    weakTags: "Needs follow-up",
    period: "Period",
    reportStatus: "Status",
    updated: "Last update",
    noReports: "No reports exist for this student.",
    openReports: "Manage reports",
    allReports: "Open report center",
    newReport: "Create a report for this student",
    editReport: "Review & edit report",
    approveReport: "Send report to administration",
    approvingReport: "Sending…",
    reportSaved: "The report was saved in the student profile.",
    reportError: "The report could not be saved. Review the period and fields, then try again.",
    publishedNotes: "Notes allowed for the student",
    internalNotes: "Internal notes",
    internalExplanation:
      "These notes are internal to the teacher and administration and are hidden from the student and parent.",
    sharedAdminNotes: "Information shared by administration",
    healthNotes: "Health notes",
    specialNotes: "Learning notes",
    addInternalNote: "Add internal note",
    notePlaceholder: "Write a useful learning follow-up note…",
    saveNote: "Save note",
    savingNote: "Saving…",
    noteSaved: "The note was saved in the student profile and remains hidden from the family.",
    noteError: "The note could not be saved. Review the text and try again.",
    noInternalNotes: "The teacher has not recorded any internal notes yet.",
    noPublishedNotes: "No published notes exist in locked evaluations.",
    visibleToStudent: "Visible to student and family",
    planSaved: "The memorization plan was saved and achievement metrics were refreshed.",
    planError: "The plan could not be saved. Review the targets and dates, then try again.",
  },
} as const;

export function TeacherStudentProfile({
  data,
  locale,
  notice,
  reportNotice,
  noteNotice,
  reportsData,
  tab,
}: {
  data: TeacherStudent360Data;
  locale: AppLocale;
  notice?: "saved" | "error";
  reportNotice?: "saved" | "error";
  noteNotice?: "saved" | "error";
  reportsData: Awaited<ReturnType<typeof getTeacherReportsData>>;
  tab: StudentProfileTab;
}) {
  const text = copy[locale];
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: data.student.timezone,
  });
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: data.student.timezone,
  });
  const latestScore = data.latestEvaluation?.evaluation?.total_score;
  const adherence = Number(data.adherence?.weekly_adherence_percent ?? 0);
  const hasPendingEvaluation = data.sessions.some(
    (session) =>
      session.ends_at < new Date().toISOString() &&
      session.attendance &&
      !session.evaluation?.is_locked,
  );

  return (
    <section
      className="teacher-reference-page"
      aria-labelledby="student-profile-title"
      data-testid="teacher-student-profile"
    >
      <Button asChild variant="ghost" size="sm" className="mb-3 px-0 hover:bg-transparent">
        <Link href="/teacher/students">
          {locale === "ar" ? <ArrowRight /> : <ArrowLeft />}
          {text.back}
        </Link>
      </Button>
      <header className="rounded-2xl border border-secondary/25 bg-card p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-secondary">
              <UserRound className="size-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  id="student-profile-title"
                  className="text-2xl font-black text-primary sm:text-3xl"
                >
                  {data.student.name}
                </h1>
                <Badge variant={data.student.status === "active" ? "success" : "outline"}>
                  {statusLabel(data.student.status, text)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.student.number}
                {data.student.track ? ` · ${localized(data.student.track, locale)}` : ""}
                {data.student.level ? ` · ${localized(data.student.level, locale)}` : ""}
              </p>
            </div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[32rem]">
            <Fact label={text.assignedTeacher} value={data.teacher.name || text.noData} />
            <Fact label={text.joined} value={date.format(new Date(data.student.joinedAt))} />
            <Fact label={text.timezone} value={data.student.timezone} />
          </dl>
        </div>
      </header>

      <nav
        className="mt-4 flex [scrollbar-width:none] gap-1 overflow-x-auto rounded-2xl border border-secondary/20 bg-card p-1.5 shadow-sm [&::-webkit-scrollbar]:hidden"
        aria-label={text.overview}
        data-testid="student-profile-tabs"
      >
        {tabs.map((item) => (
          <Link
            key={item}
            href={`/teacher/students/${data.student.id}?tab=${item}`}
            aria-current={tab === item ? "page" : undefined}
            className={`min-h-11 shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${tab === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/55 hover:text-foreground"}`}
          >
            {text[item]}
          </Link>
        ))}
      </nav>

      {notice ? (
        <Alert className="mt-4" variant={notice === "saved" ? "success" : "warning"}>
          {notice === "saved" ? text.planSaved : text.planError}
        </Alert>
      ) : null}

      <div className="mt-5">
        {tab === "overview" ? (
          <Overview
            data={data}
            text={text}
            dateTime={dateTime}
            adherence={adherence}
            latestScore={latestScore}
            hasPendingEvaluation={hasPendingEvaluation}
          />
        ) : null}
        {tab === "sessions" ? (
          <Sessions data={data} locale={locale} text={text} dateTime={dateTime} />
        ) : null}
        {tab === "plan" ? (
          <Plan data={data} locale={locale} text={text} adherence={adherence} />
        ) : null}
        {tab === "evaluations" ? (
          <Evaluations data={data} locale={locale} text={text} dateTime={dateTime} />
        ) : null}
        {tab === "reports" ? (
          <Reports
            data={data}
            locale={locale}
            text={text}
            date={date}
            notice={reportNotice}
            reportsData={reportsData}
          />
        ) : null}
        {tab === "notes" ? (
          <Notes data={data} text={text} dateTime={dateTime} locale={locale} notice={noteNotice} />
        ) : null}
      </div>
    </section>
  );
}

function Overview({
  data,
  text,
  dateTime,
  adherence,
  latestScore,
  hasPendingEvaluation,
}: {
  data: TeacherStudent360Data;
  text: (typeof copy)[AppLocale];
  dateTime: Intl.DateTimeFormat;
  adherence: number;
  latestScore: number | null | undefined;
  hasPendingEvaluation: boolean;
}) {
  const tasks = [
    hasPendingEvaluation ? text.pendingEvaluation : null,
    data.reviewPages.length ? `${data.reviewPages.length} · ${text.reviewDue}` : null,
  ].filter(Boolean);
  return (
    <>
      <div className="teacher-metrics-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeacherMetricCard
          icon={BookOpenCheck}
          label={text.mastered}
          value={data.masteredPages}
          tone="green"
        />
        <TeacherMetricCard
          icon={ChartNoAxesCombined}
          label={text.adherence}
          value={data.plan ? `${Math.round(adherence)}%` : "—"}
          tone="gold"
        />
        <TeacherMetricCard
          icon={NotebookTabs}
          label={text.review}
          value={data.reviewPages.length}
          tone="red"
        />
        <TeacherMetricCard
          icon={ClipboardCheck}
          label={text.latestScore}
          value={latestScore == null ? "—" : `${Math.round(Number(latestScore))}%`}
          tone="violet"
        />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <TeacherPanel
          title={text.nextSession}
          action={<CalendarClock className="size-5 text-secondary" aria-hidden="true" />}
        >
          {data.nextSession ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xl font-black text-primary">
                  {dateTime.format(new Date(data.nextSession.scheduled_at))}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {format(text.minutes, { count: data.nextSession.duration_min })}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/teacher/schedule">{text.openSchedule}</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{text.noSessions}</p>
          )}
        </TeacherPanel>
        <TeacherPanel title={text.urgent} action={<CircleTask count={tasks.length} />}>
          {tasks.length ? (
            <ul className="grid gap-2">
              {tasks.map((task) => (
                <li
                  key={task}
                  className="rounded-xl bg-warning/10 px-3 py-2 text-sm font-bold text-foreground"
                >
                  {task}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{text.noUrgent}</p>
          )}
        </TeacherPanel>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/teacher/students/${data.student.id}?tab=plan`}>{text.editPlan}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/teacher/students/${data.student.id}?tab=evaluations`}>
            {text.openEvaluation}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/teacher/students/${data.student.id}?tab=sessions`}>{text.sessions}</Link>
        </Button>
      </div>
    </>
  );
}

function Sessions({
  data,
  locale,
  text,
  dateTime,
}: {
  data: TeacherStudent360Data;
  locale: AppLocale;
  text: (typeof copy)[AppLocale];
  dateTime: Intl.DateTimeFormat;
}) {
  if (!data.sessions.length) return <Empty icon={CalendarClock} text={text.noSessions} />;
  return (
    <TeacherPanel title={text.sessions}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr>
              {[
                text.date,
                text.kind,
                text.sessionStatus,
                text.attendance,
                text.duration,
                text.score,
                "",
              ].map((item) => (
                <th key={item} className="px-3 py-3 text-start">
                  {item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sessions.map((session) => (
              <tr key={session.id} className="border-b border-secondary/15 last:border-0">
                <td className="px-3 py-4 font-bold text-primary">
                  {dateTime.format(new Date(session.scheduled_at))}
                </td>
                <td className="px-3 py-4">{enumLabel("sessionKind", session.kind, locale)}</td>
                <td className="px-3 py-4">
                  <Badge variant="outline">
                    {enumLabel("sessionStatus", session.status, locale)}
                  </Badge>
                </td>
                <td className="px-3 py-4">
                  {session.attendance ? (
                    <Badge variant={attendanceVariant(session.attendance.status)}>
                      {enumLabel("attendance", session.attendance.status, locale)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-4">
                  {format(text.minutes, { count: session.duration_min })}
                </td>
                <td className="px-3 py-4 font-black tabular-nums">
                  {session.evaluation?.is_locked
                    ? `${Math.round(Number(session.evaluation.total_score))}%`
                    : "—"}
                </td>
                <td className="px-3 py-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/teacher/sessions/${session.id}`}>
                      {locale === "ar" ? "فتح الحصة" : "Open session"}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TeacherPanel>
  );
}

function Plan({
  data,
  locale,
  text,
  adherence,
}: {
  data: TeacherStudent360Data;
  locale: AppLocale;
  text: (typeof copy)[AppLocale];
  adherence: number;
}) {
  const monthly = Number(data.adherence?.monthly_adherence_percent ?? 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <TeacherPanel title={text.plan}>
        <div className="grid gap-5">
          <Achievement
            label={text.actualWeekly}
            achieved={data.adherence?.weekly_achieved_pages ?? 0}
            target={data.plan?.weekly_target_pages ?? 0}
            percent={adherence}
          />
          <Achievement
            label={text.actualMonthly}
            achieved={data.adherence?.monthly_achieved_pages ?? 0}
            target={data.plan?.monthly_target_pages ?? 0}
            percent={monthly}
          />
        </div>
      </TeacherPanel>
      <TeacherPanel title={text.editPlan}>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          {data.plan ? text.editPlan : text.planMissing}
        </p>
        <form
          action={saveMemorizationPlanAction.bind(null, locale)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="studentId" value={data.student.id} />
          <input type="hidden" name="returnToProfile" value="true" />
          <PlanField
            id="weekly"
            name="weeklyTargetPages"
            label={text.weekly}
            defaultValue={data.plan?.weekly_target_pages ?? 4}
            min={1}
          />
          <PlanField
            id="monthly"
            name="monthlyTargetPages"
            label={text.monthly}
            defaultValue={data.plan?.monthly_target_pages ?? 16}
            min={1}
          />
          <PlanField
            id="starts"
            name="startsOn"
            label={text.starts}
            defaultValue={data.plan?.starts_on ?? new Date().toISOString().slice(0, 10)}
            type="date"
          />
          <PlanField
            id="ends"
            name="endsOn"
            label={`${text.ends} · ${text.optional}`}
            defaultValue={data.plan?.ends_on ?? ""}
            type="date"
          />
          <div className="sm:col-span-2">
            <AdminSubmitButton label={text.save} pendingLabel={text.saving} />
          </div>
        </form>
      </TeacherPanel>
    </div>
  );
}

function Evaluations({
  data,
  locale,
  text,
  dateTime,
}: {
  data: TeacherStudent360Data;
  locale: AppLocale;
  text: (typeof copy)[AppLocale];
  dateTime: Intl.DateTimeFormat;
}) {
  const rows = data.sessions.filter((session) => session.evaluation?.is_locked);
  const pending = data.sessions.filter(
    (session) =>
      session.status === "held" &&
      (session.attendance?.status === "present" || session.attendance?.status === "late") &&
      !session.evaluation?.is_locked,
  );
  if (!rows.length && !pending.length)
    return <Empty icon={ClipboardCheck} text={text.noEvaluations} />;
  return (
    <div className="grid gap-5">
      {pending.length ? (
        <TeacherPanel title={text.pendingEvaluations}>
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((session) => (
              <article
                key={session.id}
                className="rounded-xl border border-warning/30 bg-warning/5 p-4"
              >
                <p className="font-black text-primary">
                  {dateTime.format(new Date(session.scheduled_at))}
                </p>
                <Button asChild className="mt-3" size="sm">
                  <Link href={`/teacher/sessions/${session.id}`}>{text.openSessionEvaluation}</Link>
                </Button>
              </article>
            ))}
          </div>
        </TeacherPanel>
      ) : null}
      {rows.length ? (
        <h2 className="text-xl font-black text-primary">{text.lockedEvaluations}</h2>
      ) : null}
      {rows.map((session) => {
        const evaluation = session.evaluation!;
        const from = one(evaluation.from_ayah);
        const to = one(evaluation.to_ayah);
        return (
          <article
            key={evaluation.id}
            className="rounded-2xl border bg-card p-4 shadow-card sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-primary">
                  {dateTime.format(new Date(session.scheduled_at))}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {text.recitationType}: {enumLabel("evaluation", evaluation.session_type, locale)}
                </p>
              </div>
              <Badge variant="success">{Math.round(Number(evaluation.total_score))}%</Badge>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-secondary/15 pt-4 sm:grid-cols-3">
              <Fact label={text.range} value={formatRange(from, to, locale, text)} />
              <Fact label={text.decision} value={evaluation.decision || text.noData} />
              <Fact
                label={text.weakTags}
                value={evaluation.weak_tags.length ? evaluation.weak_tags.join("، ") : text.noData}
              />
            </dl>
            {evaluation.family_note ? (
              <div className="mt-4 rounded-xl bg-success/8 p-3">
                <p className="text-xs font-black text-success">{text.teacherNote}</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{evaluation.family_note}</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Reports({
  data,
  locale,
  text,
  date,
  notice,
  reportsData,
}: {
  data: TeacherStudent360Data;
  locale: AppLocale;
  text: (typeof copy)[AppLocale];
  date: Intl.DateTimeFormat;
  notice?: "saved" | "error";
  reportsData: Awaited<ReturnType<typeof getTeacherReportsData>>;
}) {
  const reports = reportsData.reports.filter((report) => report.student_id === data.student.id);
  const student = { id: data.student.id, name: data.student.name };
  return (
    <div className="grid gap-4">
      {notice ? (
        <Alert variant={notice === "saved" ? "success" : "warning"}>
          {notice === "saved" ? text.reportSaved : text.reportError}
        </Alert>
      ) : null}
      <TeacherPanel
        title={text.newReport}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/teacher/reports">{text.allReports}</Link>
          </Button>
        }
      >
        <ReportForm
          locale={locale}
          students={[student]}
          templates={reportsData.templates}
          t={getTeacherReportCopy(locale)}
          fixedStudent={student}
          returnToStudentId={data.student.id}
        />
      </TeacherPanel>
      <TeacherPanel title={text.reports}>
        {reports.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr>
                  {[text.period, text.reportStatus, text.updated].map((item) => (
                    <th key={item} className="px-3 py-3 text-start">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b border-secondary/15 last:border-0">
                    <td className="px-3 py-4 font-bold text-primary">
                      {date.format(new Date(report.period_start))} –{" "}
                      {date.format(new Date(report.period_end))}
                    </td>
                    <td className="px-3 py-4">
                      <Badge variant={report.status === "visible" ? "success" : "outline"}>
                        {enumLabel("report", report.status, locale)}
                      </Badge>
                    </td>
                    <td className="px-3 py-4">{date.format(new Date(report.updated_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{text.noReports}</p>
        )}
      </TeacherPanel>
      {reports
        .filter((report) => report.status === "draft" || report.status === "admin_review")
        .map((report) => (
          <TeacherPanel key={report.id} title={text.editReport}>
            <ReportForm
              locale={locale}
              students={[student]}
              templates={reportsData.templates}
              t={getTeacherReportCopy(locale)}
              report={report}
              fixedStudent={student}
              returnToStudentId={data.student.id}
            />
            <form action={approveReportAction.bind(null, locale)} className="mt-5 border-t pt-5">
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="returnToStudentId" value={data.student.id} />
              <AdminSubmitButton label={text.approveReport} pendingLabel={text.approvingReport} />
            </form>
          </TeacherPanel>
        ))}
    </div>
  );
}

function Notes({
  data,
  text,
  dateTime,
  locale,
  notice,
}: {
  data: TeacherStudent360Data;
  text: (typeof copy)[AppLocale];
  dateTime: Intl.DateTimeFormat;
  locale: AppLocale;
  notice?: "saved" | "error";
}) {
  return (
    <div className="grid gap-4">
      {notice ? (
        <Alert variant={notice === "saved" ? "success" : "warning"}>
          {notice === "saved" ? text.noteSaved : text.noteError}
        </Alert>
      ) : null}
      {data.sharedNotes ? (
        <TeacherPanel title={text.sharedAdminNotes}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label={text.healthNotes} value={data.sharedNotes.health_notes || text.noData} />
            <Fact label={text.specialNotes} value={data.sharedNotes.special_notes || text.noData} />
          </dl>
        </TeacherPanel>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <TeacherPanel
          title={text.publishedNotes}
          action={<ShieldCheck className="size-5 text-success" aria-hidden="true" />}
        >
          {data.publishedNotes.length ? (
            <ul className="grid gap-3">
              {data.publishedNotes.map((item) => (
                <li key={item.id} className="rounded-xl border border-success/20 bg-success/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <time className="text-xs font-bold text-muted-foreground">
                      {dateTime.format(new Date(item.date))}
                    </time>
                    <Badge variant="success">{text.visibleToStudent}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-foreground">{item.note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{text.noPublishedNotes}</p>
          )}
        </TeacherPanel>
        <TeacherPanel
          title={text.internalNotes}
          action={<MessageSquareText className="size-5 text-secondary" aria-hidden="true" />}
        >
          <p className="text-sm leading-7 text-muted-foreground">{text.internalExplanation}</p>
          <form
            action={saveTeacherStudentNoteAction.bind(null, locale)}
            className="mt-4 grid gap-3"
          >
            <input type="hidden" name="studentId" value={data.student.id} />
            <Label htmlFor="teacher-internal-note">{text.addInternalNote}</Label>
            <textarea
              id="teacher-internal-note"
              name="body"
              minLength={2}
              maxLength={2000}
              required
              placeholder={text.notePlaceholder}
              className="min-h-28 resize-y rounded-xl border bg-background px-3 py-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            <AdminSubmitButton label={text.saveNote} pendingLabel={text.savingNote} />
          </form>
          <div className="mt-5 border-t border-secondary/15 pt-4">
            {data.teacherNotes.length ? (
              <ol className="grid gap-3">
                {data.teacherNotes.map((note) => (
                  <li key={note.id} className="rounded-xl border bg-muted/30 p-3">
                    <time className="text-xs font-bold text-muted-foreground">
                      {dateTime.format(new Date(note.created_at))}
                    </time>
                    <p className="mt-2 text-sm leading-7 text-foreground">{note.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{text.noInternalNotes}</p>
            )}
          </div>
        </TeacherPanel>
      </div>
    </div>
  );
}

function PlanField({
  id,
  name,
  label,
  defaultValue,
  min,
  type = "number",
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string | number;
  min?: number;
  type?: "number" | "date";
}) {
  return (
    <div>
      <Label htmlFor={`${id}-${name}`}>{label}</Label>
      <Input
        id={`${id}-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        min={min}
        required={name !== "endsOn"}
        className="mt-1.5"
      />
    </div>
  );
}
function Achievement({
  label,
  achieved,
  target,
  percent,
}: {
  label: string;
  achieved: number | null;
  target: number;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <strong className="text-primary tabular-nums">
          {achieved ?? 0}/{target}
        </strong>
      </div>
      <Progress value={percent} aria-label={`${label} ${Math.round(percent)}%`} />
      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{Math.round(percent)}%</p>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-black text-foreground">{value}</dd>
    </div>
  );
}
function Empty({ icon: Icon, text }: { icon: typeof CalendarClock; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/70 p-10 text-center">
      <Icon className="mx-auto size-10 text-secondary" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-muted-foreground">{text}</p>
    </div>
  );
}
function CircleTask({ count }: { count: number }) {
  return (
    <span className="grid size-7 place-items-center rounded-full bg-secondary/15 text-xs font-black text-primary tabular-nums">
      {count}
    </span>
  );
}
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
function localized(value: { nameAr: string; nameEn: string | null }, locale: AppLocale) {
  return locale === "ar" ? value.nameAr : value.nameEn || value.nameAr;
}
function format(value: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)),
    value,
  );
}
function statusLabel(
  status: TeacherStudent360Data["student"]["status"],
  text: (typeof copy)[AppLocale],
) {
  return text[status];
}
function attendanceVariant(status: string): "success" | "warning" | "destructive" | "outline" {
  if (status === "present") return "success";
  if (status === "late" || status === "student_excused") return "warning";
  if (status === "student_absent") return "destructive";
  return "outline";
}

const enumLabels = {
  ar: {
    sessionKind: { regular: "حصة عادية", trial: "تجريبية", makeup: "تعويضية", extra: "إضافية" },
    sessionStatus: {
      scheduled: "مجدولة",
      held: "تمت",
      missed: "لم تتم",
      cancelled: "ملغاة",
      rescheduled: "أعيدت جدولتها",
    },
    attendance: {
      present: "حاضر",
      late: "متأخر",
      student_absent: "غياب طالب",
      student_excused: "غياب بعذر",
      teacher_absent: "غياب المعلم",
      cancelled: "ملغاة",
    },
    evaluation: {
      new_memo: "حفظ جديد",
      near_review: "مراجعة قريبة",
      far_review: "مراجعة بعيدة",
      recitation: "تلاوة",
      noorani: "نورانية",
      matn_theory: "متن نظري",
    },
    report: {
      draft: "مسودة",
      approved: "أرسل للإدارة",
      admin_review: "قيد المراجعة",
      visible: "منشور",
    },
  },
  en: {
    sessionKind: { regular: "Regular", trial: "Trial", makeup: "Makeup", extra: "Extra" },
    sessionStatus: {
      scheduled: "Scheduled",
      held: "Held",
      missed: "Missed",
      cancelled: "Cancelled",
      rescheduled: "Rescheduled",
    },
    attendance: {
      present: "Present",
      late: "Late",
      student_absent: "Student absent",
      student_excused: "Excused absence",
      teacher_absent: "Teacher absent",
      cancelled: "Cancelled",
    },
    evaluation: {
      new_memo: "New memorization",
      near_review: "Near review",
      far_review: "Far review",
      recitation: "Recitation",
      noorani: "Noorani",
      matn_theory: "Matn theory",
    },
    report: {
      draft: "Draft",
      approved: "Sent to administration",
      admin_review: "Under review",
      visible: "Published",
    },
  },
} as const;

function enumLabel(group: keyof (typeof enumLabels)[AppLocale], value: string, locale: AppLocale) {
  const labels = enumLabels[locale][group] as Record<string, string>;
  return labels[value] ?? value;
}

function formatRange(
  from: NonNullable<TeacherStudent360Data["sessions"][number]["evaluation"]>["from_ayah"],
  to: NonNullable<TeacherStudent360Data["sessions"][number]["evaluation"]>["to_ayah"],
  locale: AppLocale,
  text: (typeof copy)[AppLocale],
) {
  const first = one(from);
  const last = one(to);
  if (!first || !last) return text.noData;
  const surah = one(first.surah);
  const name = surah ? (locale === "ar" ? surah.name_ar : surah.name_en || surah.name_ar) : "";
  return `${name} · ${text.page} ${first.page} ${text.to} ${last.page}`;
}
