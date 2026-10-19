import { BadgeCheck, CalendarClock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  acceptConductAction,
  deleteAvailabilityAction,
  proposeAvailabilityAction,
} from "@/lib/teachers/actions";
import { getOwnTeacherAvailability } from "@/lib/teachers/management";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function TeacherAvailabilitySection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, teacher, query] = await Promise.all([
    getTranslations({ locale, namespace: "teacherAvailability" }),
    getOwnTeacherAvailability(),
    searchParams,
  ]);
  const status = typeof query.availabilityStatus === "string" ? query.availabilityStatus : "";
  const error = typeof query.availabilityError === "string" ? query.availabilityError : "";
  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="availability-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 id="availability-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      {status ? (
        <Alert className="mt-6" variant="success">
          {t(`notices.${status}` as "notices.proposed")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(`errors.${error}` as "errors.request_failed")}
        </Alert>
      ) : null}
      {!teacher ? (
        <Alert className="mt-8" variant="warning">
          {t("errors.profile_missing")}
        </Alert>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-card">
            <BadgeCheck className="size-7 text-secondary" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">{t("conduct.title")}</h2>
            <p className="mt-3 text-sm leading-7 text-primary-foreground/80">
              {t("conduct.description")}
            </p>
            {teacher.code_of_conduct_accepted_at ? (
              <Badge className="mt-4" variant="success">
                {t("conduct.accepted")}
              </Badge>
            ) : (
              <form action={acceptConductAction.bind(null, locale)} className="mt-4">
                <AdminSubmitButton label={t("conduct.accept")} pendingLabel={t("saving")} />
              </form>
            )}
          </aside>
          <div className="grid gap-6">
            <article className="rounded-3xl border bg-card p-6 shadow-card">
              <h2 className="flex items-center gap-2 text-xl font-black text-primary">
                <CalendarClock className="size-5 text-secondary" aria-hidden="true" />
                {t("form.title")}
              </h2>
              <form
                action={proposeAvailabilityAction.bind(null, locale)}
                className="mt-5 grid gap-4 sm:grid-cols-3"
              >
                <div className="grid gap-2">
                  <Label htmlFor="availability-weekday">{t("form.weekday")}</Label>
                  <select
                    id="availability-weekday"
                    name="weekday"
                    className="min-h-11 rounded-xl border bg-background px-3"
                  >
                    {Array.from({ length: 7 }, (_, day) => (
                      <option value={day} key={day}>
                        {t(`weekdays.${day}` as "weekdays.0")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="availability-start">{t("form.start")}</Label>
                  <Input id="availability-start" name="startTime" type="time" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="availability-end">{t("form.end")}</Label>
                  <Input id="availability-end" name="endTime" type="time" required />
                </div>
                <div className="sm:col-span-3">
                  <AdminSubmitButton label={t("form.submit")} pendingLabel={t("saving")} />
                </div>
              </form>
            </article>
            <article className="rounded-3xl border bg-card p-6 shadow-card">
              <h2 className="text-xl font-black text-primary">{t("listTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("timezone", { zone: one(teacher.profile)?.timezone ?? "" })}
              </p>
              <div className="mt-4 grid gap-3">
                {teacher.teacher_availability.length ? (
                  teacher.teacher_availability.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
                    >
                      <div>
                        <p className="font-black text-primary">
                          {t(`weekdays.${slot.weekday}` as "weekdays.0")} ·{" "}
                          {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                        </p>
                        <Badge
                          className="mt-2"
                          variant={slot.status === "approved" ? "success" : "outline"}
                        >
                          {t(`statuses.${slot.status}` as "statuses.proposed")}
                        </Badge>
                      </div>
                      {slot.status === "proposed" ? (
                        <form action={deleteAvailabilityAction.bind(null, locale)}>
                          <input type="hidden" name="availabilityId" value={slot.id} />
                          <AdminSubmitButton
                            label={t("delete")}
                            pendingLabel={t("saving")}
                            variant="destructive"
                          />
                        </form>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">{t("empty")}</p>
                )}
              </div>
            </article>
          </div>
        </div>
      )}
    </section>
  );
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
