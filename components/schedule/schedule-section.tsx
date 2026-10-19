import { CalendarClock, Clock3, Globe2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { saveScheduleSlotAction } from "@/lib/schedules/actions";
import { getScheduleWorkspace, relation } from "@/lib/schedules/management";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function ScheduleSection({
  locale,
  searchParams = Promise.resolve({}),
}: {
  locale: AppLocale;
  searchParams?: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "schedules" }),
    getScheduleWorkspace(),
    searchParams,
  ]);
  const status = typeof query.scheduleStatus === "string" ? query.scheduleStatus : "";
  const error = typeof query.scheduleError === "string" ? query.scheduleError : "";
  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="schedule-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 id="schedule-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        <Badge className="mt-4" variant="outline">
          <Globe2 className="size-4" aria-hidden="true" /> {data.timezone}
        </Badge>
      </header>
      {status ? (
        <Alert className="mt-6" variant="success">
          {t("saved")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(`errors.${error}` as "errors.invalid_fields")}
        </Alert>
      ) : null}
      {data.role === "admin" ? (
        <form
          action={saveScheduleSlotAction.bind(null, locale)}
          className="mt-8 grid gap-4 rounded-3xl border bg-card p-5 shadow-card lg:grid-cols-5 lg:items-end"
        >
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="schedule-assignment">{t("assignment")}</Label>
            <select
              id="schedule-assignment"
              name="assignmentId"
              required
              className="min-h-11 rounded-xl border bg-background px-3"
            >
              <option value="">{t("chooseAssignment")}</option>
              {data.assignments.map((assignment) => {
                const student = relation(assignment.student);
                const teacher = relation(assignment.teacher);
                const profile = teacher ? relation(teacher.profile) : null;
                const track = relation(assignment.track);
                return (
                  <option key={assignment.id} value={assignment.id}>
                    {student?.full_name} · {profile?.full_name} ·{" "}
                    {locale === "ar" ? track?.name_ar : (track?.name_en ?? track?.name_ar)}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-weekday">{t("weekday")}</Label>
            <select
              id="schedule-weekday"
              name="weekday"
              required
              className="min-h-11 rounded-xl border bg-background px-3"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <option value={day} key={day}>
                  {t(`weekdays.${day}` as "weekdays.0")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-time">{t("time")}</Label>
            <Input id="schedule-time" name="localStartTime" type="time" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-duration">{t("duration")}</Label>
            <Input
              id="schedule-duration"
              name="durationMin"
              type="number"
              min={10}
              max={120}
              defaultValue={30}
              required
            />
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <Label htmlFor="schedule-timezone">{t("anchorTimezone")}</Label>
            <Input
              id="schedule-timezone"
              name="anchorTimezone"
              defaultValue="Africa/Cairo"
              required
            />
          </div>
          <div className="lg:col-span-3">
            <AdminSubmitButton label={t("save")} pendingLabel={t("saving")} />
          </div>
        </form>
      ) : null}
      <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.slots.length ? (
          data.slots.map((slot) => (
            <article key={slot.slot_id} className="rounded-3xl border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <CalendarClock className="size-6 text-secondary" aria-hidden="true" />
                <Badge variant="success">{t("weekly")}</Badge>
              </div>
              <h2 className="mt-4 text-xl font-black text-primary">{slot.student_name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {slot.teacher_name} ·{" "}
                {locale === "ar" ? slot.track_name_ar : (slot.track_name_en ?? slot.track_name_ar)}
              </p>
              <p className="mt-4 flex items-center gap-2 font-bold">
                <Clock3 className="size-4" aria-hidden="true" />
                {t(`weekdays.${slot.viewer?.weekday ?? slot.weekday}` as "weekdays.0")} ·{" "}
                {slot.viewer?.time.slice(0, 5) ?? slot.local_start_time.slice(0, 5)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("durationValue", { count: slot.duration_min })}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{data.timezone}</p>
              {data.timezone !== slot.anchor_timezone ? (
                <p className="mt-3 rounded-xl bg-accent/50 p-3 text-xs leading-6">
                  {t("anchorNote", {
                    timezone: slot.anchor_timezone,
                    day: t(`weekdays.${slot.weekday}` as "weekdays.0"),
                    time: slot.local_start_time.slice(0, 5),
                  })}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-muted-foreground md:col-span-2">
            {t("empty")}
          </p>
        )}
      </div>
    </section>
  );
}
