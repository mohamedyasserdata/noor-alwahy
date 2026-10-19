import { ArrowRightLeft, UserRoundCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { manageAssignmentAction } from "@/lib/assignments/actions";
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
        className="mt-8 grid gap-4 rounded-3xl border bg-card p-5 shadow-card md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="assignment-student">{t("student")}</Label>
          <select
            id="assignment-student"
            name="studentId"
            defaultValue={data.selection?.studentId}
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
        <div className="grid gap-2">
          <Label htmlFor="assignment-track">{t("track")}</Label>
          <select
            id="assignment-track"
            name="trackId"
            defaultValue={data.selection?.trackId}
            className="min-h-11 rounded-xl border bg-background px-3"
            required
          >
            <option value="">{t("chooseTrack")}</option>
            {data.tracks.map((track) => (
              <option value={track.id} key={track.id}>
                {locale === "ar" ? track.name_ar : (track.name_en ?? track.name_ar)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-primary px-5 font-black text-primary-foreground"
        >
          {t("suggest")}
        </button>
      </form>
      {selection ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <h2 className="text-2xl font-black text-primary">
              {current ? t("changeTitle") : t("candidateTitle")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("candidateDescription")}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {data.suggestions.length ? (
                data.suggestions.map((candidate) => (
                  <article
                    key={candidate.teacher_id}
                    className="rounded-3xl border bg-card p-5 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-primary">{candidate.teacher_name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{candidate.timezone}</p>
                      </div>
                      {candidate.near_capacity ? (
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
                      action={manageAssignmentAction.bind(null, locale)}
                      className="mt-5 grid gap-3"
                    >
                      <Hidden
                        selection={selection}
                        teacherId={candidate.teacher_id}
                        action={current ? "change" : "assign"}
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
                        label={current ? t("change") : t("assign")}
                        pendingLabel={t("saving")}
                      />
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
