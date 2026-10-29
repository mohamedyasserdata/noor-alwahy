import { CalendarClock, CreditCard, UserRoundPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DateTime } from "luxon";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  createSubscriptionAction,
  pauseSubscriptionAction,
  processRenewalsAction,
  requestSubscriptionChangeAction,
} from "@/lib/subscriptions/actions";
import { getSubscriptionAdminData } from "@/lib/subscriptions/queries";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function SubscriptionAdminSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "subscriptionAdmin" }),
    getSubscriptionAdminData(),
    searchParams,
  ]);
  const status = typeof query.subscriptionStatus === "string" ? query.subscriptionStatus : "";
  const error = typeof query.subscriptionError === "string" ? query.subscriptionError : "";
  const alerts = typeof query.alerts === "string" ? query.alerts : "0";
  const invoices = typeof query.invoices === "string" ? query.invoices : "0";
  const requestedStudent = typeof query.student === "string" ? query.student : "";
  const visibleSubscriptions = requestedStudent
    ? data.subscriptions.filter((subscription) => subscription.student_id === requestedStudent)
    : data.subscriptions;
  const today = DateTime.utc().toISODate() ?? "";
  const localized = (value: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? value.name_ar : (value.name_en ?? value.name_ar);

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="subscriptions-title">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1
            id="subscriptions-title"
            className="mt-3 text-3xl font-black text-primary sm:text-4xl"
          >
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <form action={processRenewalsAction.bind(null, locale)}>
          <input type="hidden" name="asOf" value={today} />
          <AdminSubmitButton label={t("runRenewals")} pendingLabel={t("runningRenewals")} />
        </form>
      </header>
      {status ? (
        <p className="mt-5 rounded-xl bg-success/10 p-4 font-bold text-success">
          {status === "renewals_processed"
            ? t("notices.renewals_processed", { alerts, invoices })
            : t(`notices.${status}` as "notices.created")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {t(`errors.${error}` as "errors.create_failed")}
        </p>
      ) : null}

      <form
        action={createSubscriptionAction.bind(null, locale, false)}
        className="mt-8 rounded-3xl border bg-card p-5 shadow-card sm:p-7"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-secondary/15 text-secondary">
            <UserRoundPlus aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-black text-primary">{t("createTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("snapshotHint")}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FieldSelect
            id="subscription-student"
            name="studentId"
            label={t("student")}
            defaultValue={requestedStudent}
            required
          >
            <option value="">{t("chooseStudent")}</option>
            {data.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.full_name}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect id="subscription-package" name="packageId" label={t("package")} required>
            <option value="">{t("choosePackage")}</option>
            {data.packages.map((item) => (
              <option key={item.id} value={item.id}>
                {localized(item)}
              </option>
            ))}
          </FieldSelect>
          <FieldSelect id="subscription-country" name="countryCode" label={t("country")} required>
            <option value="">{t("chooseCountry")}</option>
            {data.countries.map((country) => (
              <option key={country.code} value={country.code}>
                {localized(country)} · {country.currency}
              </option>
            ))}
          </FieldSelect>
          <div className="grid gap-2">
            <Label htmlFor="subscription-start">{t("startDate")}</Label>
            <Input
              id="subscription-start"
              name="startDate"
              type="date"
              defaultValue={today}
              required
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <AdminSubmitButton label={t("create")} pendingLabel={t("creating")} />
        </div>
      </form>

      <div className="mt-8 grid gap-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-secondary" aria-hidden="true" />
          <h2 className="text-xl font-black text-primary">{t("currentTitle")}</h2>
        </div>
        {visibleSubscriptions.length ? (
          visibleSubscriptions.map((subscription) => {
            const student = Array.isArray(subscription.students)
              ? subscription.students[0]
              : subscription.students;
            const packageData = Array.isArray(subscription.packages)
              ? subscription.packages[0]
              : subscription.packages;
            const scheduledPackage = data.packages.find(
              (item) => item.id === subscription.scheduled_package_id,
            );
            const canManage = subscription.status === "active" || subscription.status === "paused";
            return (
              <article
                key={subscription.id}
                className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-primary">
                      {student?.full_name ?? t("unknownStudent")}
                    </h3>
                    <Badge variant={subscription.status === "active" ? "success" : "secondary"}>
                      {t(`states.${subscription.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {packageData ? localized(packageData) : t("legacyPackage")}
                  </p>
                </div>
                <div className="grid gap-4">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:text-end">
                    <div>
                      <dt className="text-muted-foreground">{t("period")}</dt>
                      <dd className="font-bold">
                        {subscription.current_period_start} — {subscription.current_period_end}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("fixedPrice")}</dt>
                      <dd className="font-bold" dir="ltr">
                        {subscription.price_amount ?? "—"} {subscription.price_currency ?? ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("sessions")}</dt>
                      <dd className="font-bold">{subscription.sessions_per_period}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("renewal")}</dt>
                      <dd className="flex items-center justify-end gap-1 font-bold">
                        <CalendarClock className="size-4" aria-hidden="true" />
                        {subscription.renew_date ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  {scheduledPackage ? (
                    <p className="rounded-xl bg-secondary/10 px-3 py-2 text-sm font-bold text-primary">
                      {t("scheduledPackage", { package: localized(scheduledPackage) })}
                    </p>
                  ) : null}
                  {subscription.paused_until ? (
                    <p className="rounded-xl bg-warning/10 px-3 py-2 text-sm font-bold text-foreground">
                      {t("pausedUntil", { date: subscription.paused_until })}
                      {subscription.pause_reason ? ` · ${subscription.pause_reason}` : ""}
                    </p>
                  ) : null}
                  {canManage ? (
                    <div className="grid gap-3 border-t pt-4 lg:grid-cols-2">
                      {subscription.status === "active" ? (
                        <form
                          action={pauseSubscriptionAction.bind(null, locale)}
                          className="grid gap-2 rounded-xl border p-3"
                        >
                          <input type="hidden" name="subscriptionId" value={subscription.id} />
                          <Label htmlFor={`pause-until-${subscription.id}`}>
                            {t("pauseUntil")}
                          </Label>
                          <Input
                            id={`pause-until-${subscription.id}`}
                            name="pausedUntil"
                            type="date"
                            min={today}
                            required
                          />
                          <Label htmlFor={`pause-reason-${subscription.id}`}>
                            {t("pauseReason")}
                          </Label>
                          <Input
                            id={`pause-reason-${subscription.id}`}
                            name="reason"
                            minLength={2}
                            maxLength={500}
                            required
                          />
                          <AdminSubmitButton label={t("pause")} pendingLabel={t("pausing")} />
                        </form>
                      ) : null}
                      <form
                        action={requestSubscriptionChangeAction.bind(null, locale)}
                        className="grid gap-2 rounded-xl border p-3"
                      >
                        <input type="hidden" name="subscriptionId" value={subscription.id} />
                        <FieldSelect
                          id={`change-package-${subscription.id}`}
                          name="targetPackageId"
                          label={t("changePackage")}
                          required
                        >
                          <option value="">{t("choosePackage")}</option>
                          {data.packages
                            .filter((item) => item.id !== subscription.package_id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {localized(item)}
                              </option>
                            ))}
                        </FieldSelect>
                        <p className="text-xs leading-5 text-muted-foreground">{t("changeHint")}</p>
                        <AdminSubmitButton
                          label={t("applyChange")}
                          pendingLabel={t("applyingChange")}
                        />
                      </form>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </div>
    </section>
  );
}

function FieldSelect({
  id,
  name,
  label,
  required,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="min-h-11 rounded-xl border bg-background px-3"
      >
        {children}
      </select>
    </div>
  );
}
