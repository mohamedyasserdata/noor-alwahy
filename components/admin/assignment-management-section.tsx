import { ArrowRightLeft, UserRoundCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { assignTeacherWithScheduleAction, manageAssignmentAction } from "@/lib/assignments/actions";
import { getAssignmentWorkspace } from "@/lib/assignments/management";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function AssignmentManagementSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const query = await searchParams;
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "assignmentManagement" }),
    getAssignmentWorkspace(query),
  ]);
  const status = typeof query.assignmentStatus === "string" ? query.assignmentStatus : "";
  const error = typeof query.assignmentError === "string" ? query.assignmentError : "";
  const selection = data.selection;
  const current = selection
    ? data.assignments.find(
        (item) =>
          item.student_id === selection.studentId &&
          item.track_id === selection.trackId &&
          ["active", "paused"].includes(item.status),
      )
    : null;
  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="assignment-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 id="assignment-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      {status ? (
        <Alert className="mt-6" variant="success">
          {t(`notices.${status}` as "notices.assign")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(`errors.${error}` as "errors.request_failed")}
        </Alert>
      ) : null}
      <form
        method="get"
        className="mt-8 grid gap-5 rounded-3xl border bg-card p-5 shadow-card lg:grid-cols-2"
      >
        <div className="grid gap-2">
          <Label htmlFor="assignment-student">{t("student")}</Label>
          <select
            id="assignment-student"
            name="studentId"
            defaultValue={data.selection?.studentId ?? data.requestedStudentId}
            className="min-h-11 rounded-xl border bg-background px-3"
            required
          >
            <option value="">{t("chooseStudent")}</option>
            {data.students.map((student) => (
              <option value={student.id} key={student.id}>
                {student.full_name} · {student.student_no} ·{" "}
                {t(`genders.${student.gender}` as "genders.male")}
              </option>
            ))}
          </select>
        </div>
        <input
          type="hidden"
          name="trackId"
          value={data.selection?.trackId ?? data.requestedTrackId ?? data.tracks[0]?.id ?? ""}
        />
        <fieldset className="grid gap-2 lg:col-span-2">
          <legend className="font-bold text-primary">
            {locale === "ar" ? "أيام الحصص" : "Lesson days"}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <label
                key={day}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 text-sm font-bold has-[:checked]:border-secondary has-[:checked]:bg-secondary/10"
              >
                <input
                  type="checkbox"
                  name="weekdays"
                  value={day}
                  defaultChecked={data.scheduleSelection?.weekdays.includes(day)}
                  className="size-4 accent-primary"
                />
                {locale === "ar"
                  ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][day]
                  : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2">
          <Label htmlFor="assignment-time">{locale === "ar" ? "وقت البداية" : "Start time"}</Label>
          <Input
            id="assignment-time"
            name="localStartTime"
            type="time"
            defaultValue={data.scheduleSelection?.localStartTime ?? ""}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="assignment-duration">{locale === "ar" ? "مدة الحصة" : "Duration"}</Label>
          <select
            id="assignment-duration"
            name="durationMin"
            defaultValue={data.scheduleSelection?.durationMin ?? 45}
            className="min-h-11 rounded-xl border bg-background px-3"
          >
            {[30, 45, 60, 90].map((duration) => (
              <option key={duration} value={duration}>
                {duration} {locale === "ar" ? "دقيقة" : "minutes"}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-primary px-5 font-black text-primary-foreground lg:col-span-2"
        >
          {locale === "ar" ? "عرض المدرسين لهذا الموعد" : "Show teachers for this time"}
        </button>
      </form>
      {selection && data.scheduleSelection ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <h2 className="text-2xl font-black text-primary">
              {current ? t("changeTitle") : t("candidateTitle")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("candidateDescription")}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {data.suggestions.length ? (
                [...data.suggestions]
                  .sort(
                    (first, second) =>
                      Number(second.availableForTime) - Number(first.availableForTime),
                  )
                  .map((candidate, index, all) => (
                    <article
                      key={candidate.teacher_id}
                      className={`rounded-3xl border bg-card p-5 shadow-card ${!candidate.availableForTime ? "border-dashed opacity-90" : "border-secondary/40"}`}
                    >
                      {index === 0 ||
                      all[index - 1]?.availableForTime !== candidate.availableForTime ? (
                        <p className="mb-4 border-b pb-3 text-sm font-black text-secondary md:col-span-2">
                          {candidate.availableForTime
                            ? locale === "ar"
                              ? "متاحون في الموعد المختار"
                              : "Available at the selected time"
                            : locale === "ar"
                              ? "باقي المدرسين"
                              : "Other teachers"}
                        </p>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-primary">{candidate.teacher_name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{candidate.timezone}</p>
                        </div>
                        {!candidate.availableForTime ? (
                          <Badge variant="outline">
                            {locale === "ar" ? "الموعد غير متاح" : "Time unavailable"}
                          </Badge>
                        ) : candidate.near_capacity ? (
                          <Badge variant="warning">{t("nearCapacity")}</Badge>
                        ) : (
                          <Badge variant="success">{t("available")}</Badge>
                        )}
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-muted-foreground">{t("load")}</dt>
                          <dd className="font-black">
                            {candidate.current_load}/{candidate.max_students}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t("approvedSlots")}</dt>
                          <dd className="font-black">{candidate.approved_slots}</dd>
                        </div>
                      </dl>
                      <form
                        action={assignTeacherWithScheduleAction.bind(null, locale)}
                        className="mt-5 grid gap-3"
                      >
                        <Hidden
                          selection={selection}
                          teacherId={candidate.teacher_id}
                          action={current ? "change" : "assign"}
                        />
                        <ScheduleHidden
                          schedule={data.scheduleSelection!}
                          createSchedule={candidate.availableForTime}
                        />
                        <Label htmlFor={`reason-${candidate.teacher_id}`}>{t("reason")}</Label>
                        <Input
                          id={`reason-${candidate.teacher_id}`}
                          name="reason"
                          minLength={2}
                          maxLength={500}
                          required
                        />
                        <AdminSubmitButton
                          label={
                            candidate.availableForTime
                              ? locale === "ar"
                                ? "تعيين وإنشاء الجدول"
                                : "Assign and create schedule"
                              : locale === "ar"
                                ? "تعيين فقط"
                                : "Assign only"
                          }
                          pendingLabel={t("saving")}
                        />
                        {!candidate.availableForTime ? (
                          <p className="text-xs leading-5 text-muted-foreground">
                            {locale === "ar"
                              ? "سيُعيّن المدرس دون إنشاء جدول حتى تختار موعدًا لا يتعارض مع جدوله."
                              : "The teacher will be assigned without a schedule until a conflict-free time is chosen."}
                          </p>
                        ) : null}
                      </form>
                    </article>
                  ))
              ) : (
                <p className="rounded-2xl border border-dashed p-6 text-muted-foreground md:col-span-2">
                  {t("noCandidates")}
                </p>
              )}
            </div>
          </div>
          <aside className="rounded-3xl border bg-card p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-xl font-black text-primary">
              <UserRoundCheck className="size-5 text-secondary" aria-hidden="true" />
              {t("currentTitle")}
            </h2>
            {current ? (
              <AssignmentCard locale={locale} t={t} assignment={current} controls />
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">{t("noCurrent")}</p>
            )}
          </aside>
        </div>
      ) : null}
      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-2xl font-black text-primary">
          <ArrowRightLeft className="size-6 text-secondary" aria-hidden="true" />
          {t("historyTitle")}
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {data.assignments.map((assignment) => (
            <AssignmentCard locale={locale} t={t} assignment={assignment} key={assignment.id} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScheduleHidden({
  schedule,
  createSchedule,
}: {
  schedule: NonNullable<Awaited<ReturnType<typeof getAssignmentWorkspace>>["scheduleSelection"]>;
  createSchedule: boolean;
}) {
  return (
    <>
      {schedule.weekdays.map((day) => (
        <input key={day} type="hidden" name="weekdays" value={day} />
      ))}
      <input type="hidden" name="localStartTime" value={schedule.localStartTime} />
      <input type="hidden" name="durationMin" value={schedule.durationMin} />
      <input type="hidden" name="createSchedule" value={String(createSchedule)} />
    </>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations<"assignmentManagement">>>;
type Selection = { studentId: string; trackId: string };
function Hidden({
  selection,
  teacherId,
  action,
}: {
  selection: Selection;
  teacherId: string;
  action: string;
}) {
  return (
    <>
      <input type="hidden" name="studentId" value={selection.studentId} />
      <input type="hidden" name="trackId" value={selection.trackId} />
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}
function AssignmentCard({
  locale,
  t,
  assignment,
  controls = false,
}: {
  locale: AppLocale;
  t: Translator;
  assignment: Awaited<ReturnType<typeof getAssignmentWorkspace>>["assignments"][number];
  controls?: boolean;
}) {
  const student = one(assignment.student);
  const teacher = one(assignment.teacher);
  const profile = teacher ? one(teacher.profile) : null;
  const track = one(assignment.track);
  return (
    <article className="mt-4 rounded-2xl border p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="font-black text-primary">{student?.full_name}</h3>
          <p className="text-sm text-muted-foreground">
            {profile?.full_name} ·{" "}
            {locale === "ar" ? track?.name_ar : (track?.name_en ?? track?.name_ar)}
          </p>
        </div>
        <Badge
          variant={
            assignment.status === "active"
              ? "success"
              : assignment.status === "paused"
                ? "warning"
                : "outline"
          }
        >
          {t(`statuses.${assignment.status}` as "statuses.active")}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
        <a
          className="text-primary underline-offset-4 hover:underline"
          href={`/${locale}/admin/students/${assignment.student_id}`}
        >
          {locale === "ar" ? "ملف الطالب" : "Student profile"}
        </a>
        <a
          className="text-primary underline-offset-4 hover:underline"
          href={`/${locale}/admin/teachers/${assignment.teacher_id}`}
        >
          {locale === "ar" ? "ملف المعلم" : "Teacher profile"}
        </a>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{assignment.reason}</p>
      {controls ? (
        <div className="mt-4 grid gap-3">
          {assignment.status === "active" ? (
            <ActionForm locale={locale} t={t} assignment={assignment} action="pause" />
          ) : (
            <ActionForm locale={locale} t={t} assignment={assignment} action="resume" />
          )}
          <ActionForm locale={locale} t={t} assignment={assignment} action="end" />
        </div>
      ) : null}
    </article>
  );
}
function ActionForm({
  locale,
  t,
  assignment,
  action,
}: {
  locale: AppLocale;
  t: Translator;
  assignment: Awaited<ReturnType<typeof getAssignmentWorkspace>>["assignments"][number];
  action: "pause" | "resume" | "end";
}) {
  return (
    <form action={manageAssignmentAction.bind(null, locale)} className="grid gap-2">
      <Hidden
        selection={{ studentId: assignment.student_id, trackId: assignment.track_id }}
        teacherId={assignment.teacher_id}
        action={action}
      />
      <Label htmlFor={`${action}-${assignment.id}`}>{t("reason")}</Label>
      <Input
        id={`${action}-${assignment.id}`}
        name="reason"
        required
        minLength={2}
        maxLength={500}
      />
      <AdminSubmitButton
        label={`${t(action)} `}
        pendingLabel={t("saving")}
        variant={action === "end" ? "destructive" : "outline"}
      />
    </form>
  );
}
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
