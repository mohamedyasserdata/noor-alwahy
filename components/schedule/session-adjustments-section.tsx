import { CalendarSync, ClockArrowUp, UserRoundCog } from "lucide-react";
import { DateTime } from "luxon";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  assignSessionSubstituteAction,
  createMakeupSessionAction,
  rescheduleSessionAction,
} from "@/lib/schedules/actions";
import type { getScheduleWorkspace } from "@/lib/schedules/management";

type AdjustmentData = NonNullable<Awaited<ReturnType<typeof getScheduleWorkspace>>["adjustments"]>;

export async function SessionAdjustmentsSection({
  locale,
  timezone,
  data,
  status,
  error,
}: {
  locale: AppLocale;
  timezone: string;
  data: AdjustmentData;
  status: string;
  error: string;
}) {
  const t = await getTranslations({ locale, namespace: "schedules.adjustments" });

  return (
    <section className="mt-12 border-t pt-10" aria-labelledby="session-adjustments-title">
      <div className="max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
            <CalendarSync className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="session-adjustments-title" className="text-2xl font-black text-primary">
              {t("title")}
            </h2>
            <p className="mt-1 leading-7 text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <Badge className="mt-4" variant="outline">
          {t("approvalBadge")}
        </Badge>
      </div>

      {status ? (
        <Alert className="mt-6" variant="success">
          {t(`statuses.${status}` as "statuses.substitute_saved")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(`errors.${error}` as "errors.invalid_fields")}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        {data.sessions.length ? (
          data.sessions.map((session) => {
            const student = one(session.student);
            const teacher = one(session.teacher);
            const teacherProfile = teacher ? one(teacher.profile) : null;
            const assignment = one(session.assignment);
            const eligibleTeachers = data.teachers.filter(
              (candidate) =>
                candidate.id !== teacher?.id &&
                candidate.gender === student?.gender &&
                candidate.teacher_tracks.some((track) => track.track_id === assignment?.track_id),
            );

            return (
              <article
                key={session.id}
                className="min-w-0 overflow-hidden rounded-3xl border bg-card"
              >
                <header className="border-b bg-accent/35 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-primary">{student?.full_name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("currentTeacher", { name: teacherProfile?.full_name ?? t("unknown") })}
                      </p>
                    </div>
                    <Badge variant={session.kind === "makeup" ? "warning" : "success"}>
                      {t(`kinds.${session.kind}` as "kinds.regular")}
                    </Badge>
                  </div>
                  <p className="mt-4 font-bold">
                    {formatInstant(session.scheduled_at, timezone, locale)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("duration", { count: session.duration_min })}
                  </p>
                </header>

                <div className="grid gap-6 p-5 sm:grid-cols-2">
                  <form
                    action={assignSessionSubstituteAction.bind(null, locale)}
                    className="grid min-w-0 content-start gap-3"
                  >
                    <input type="hidden" name="sessionId" value={session.id} />
                    <p className="flex items-center gap-2 font-black text-primary">
                      <UserRoundCog className="size-4 text-secondary" aria-hidden="true" />
                      {t("substituteTitle")}
                    </p>
                    <Label htmlFor={`substitute-${session.id}`}>{t("substituteTeacher")}</Label>
                    <select
                      id={`substitute-${session.id}`}
                      name="substituteTeacherId"
                      required
                      className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3"
                    >
                      <option value="">{t("chooseTeacher")}</option>
                      {eligibleTeachers.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {one(candidate.profile)?.full_name}
                        </option>
                      ))}
                    </select>
                    <Label htmlFor={`scope-${session.id}`}>{t("scope")}</Label>
                    <select
                      id={`scope-${session.id}`}
                      name="scope"
                      className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3"
                    >
                      <option value="session">{t("scopeSession")}</option>
                      <option value="week">{t("scopeWeek")}</option>
                    </select>
                    {eligibleTeachers.length ? (
                      <AdminSubmitButton label={t("saveSubstitute")} pendingLabel={t("saving")} />
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {t("noEligibleTeacher")}
                      </p>
                    )}
                  </form>

                  <form
                    action={rescheduleSessionAction.bind(null, locale)}
                    className="grid min-w-0 content-start gap-3 sm:border-s sm:ps-5"
                  >
                    <input type="hidden" name="sessionId" value={session.id} />
                    <p className="flex items-center gap-2 font-black text-primary">
                      <ClockArrowUp className="size-4 text-secondary" aria-hidden="true" />
                      {t("rescheduleTitle")}
                    </p>
                    <Label htmlFor={`reschedule-${session.id}`}>{t("newTime")}</Label>
                    <Input
                      id={`reschedule-${session.id}`}
                      name="scheduledLocal"
                      type="datetime-local"
                      required
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      {t("timezoneNote", { timezone })}
                    </p>
                    <AdminSubmitButton
                      label={t("saveReschedule")}
                      pendingLabel={t("saving")}
                      variant="outline"
                    />
                  </form>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-muted-foreground xl:col-span-2">
            {t("emptySessions")}
          </p>
        )}
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-black text-primary">{t("makeupTitle")}</h3>
        <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">{t("makeupDescription")}</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {data.entitlements.length ? (
            data.entitlements.map((entitlement) => {
              const student = one(entitlement.student);
              const source = one(entitlement.source_session);
              const assignment = source ? one(source.assignment) : null;
              const eligibleTeachers = data.teachers.filter(
                (candidate) =>
                  candidate.gender === student?.gender &&
                  candidate.teacher_tracks.some((track) => track.track_id === assignment?.track_id),
              );

              return (
                <form
                  key={entitlement.id}
                  action={createMakeupSessionAction.bind(null, locale)}
                  className="grid min-w-0 gap-4 rounded-3xl border bg-card p-5"
                >
                  <input type="hidden" name="entitlementId" value={entitlement.id} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-primary">{student?.full_name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("expires", {
                          date: formatInstant(entitlement.expires_at, timezone, locale),
                        })}
                      </p>
                    </div>
                    <Badge variant="warning">{t("availableMakeup")}</Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor={`makeup-time-${entitlement.id}`}>{t("makeupTime")}</Label>
                      <Input
                        id={`makeup-time-${entitlement.id}`}
                        name="scheduledLocal"
                        type="datetime-local"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`makeup-teacher-${entitlement.id}`}>
                        {t("makeupTeacher")}
                      </Label>
                      <select
                        id={`makeup-teacher-${entitlement.id}`}
                        name="teacherId"
                        className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3"
                      >
                        <option value="">{t("defaultTeacher")}</option>
                        {eligibleTeachers.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {one(candidate.profile)?.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <AdminSubmitButton label={t("createMakeup")} pendingLabel={t("saving")} />
                </form>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-muted-foreground lg:col-span-2">
              {t("emptyMakeups")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatInstant(value: string, timezone: string, locale: AppLocale) {
  return DateTime.fromISO(value)
    .setZone(timezone)
    .setLocale(locale)
    .toLocaleString(DateTime.DATETIME_MED);
}
