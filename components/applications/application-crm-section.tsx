import { ClipboardList, Download, GraduationCap, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DateTime } from "luxon";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  convertApplicationAction,
  savePlacementAction,
  updateApplicationAction,
} from "@/lib/applications/actions";
import { getApplicationCrm } from "@/lib/applications/crm";
import { createSubscriptionAction } from "@/lib/subscriptions/actions";

type Query = Promise<Record<string, string | string[] | undefined>>;
const states = ["new", "contacted", "trial_booked", "accepted", "rejected", "postponed"] as const;

export async function ApplicationCrmSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const query = await searchParams;
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "applicationCrm" }),
    getApplicationCrm(query),
  ]);
  const status = typeof query.applicationStatus === "string" ? query.applicationStatus : "";
  const error = typeof query.applicationError === "string" ? query.applicationError : "";
  const subscriptionStatus =
    typeof query.subscriptionStatus === "string" ? query.subscriptionStatus : "";
  const subscriptionError =
    typeof query.subscriptionError === "string" ? query.subscriptionError : "";
  const today = DateTime.utc().toISODate() ?? "";
  const name = (item: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar);
  return (
    <section className="mx-auto w-full max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-black text-primary sm:text-4xl">{t("title")}</h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild variant="outline">
          <a href={`/api/admin/applications/export?locale=${locale}`}>
            <Download aria-hidden="true" />
            {t("export")}
          </a>
        </Button>
      </header>
      {status ? (
        <p className="mt-5 rounded-xl bg-success/10 p-4 font-bold text-success">
          {t(`notices.${status}` as "notices.updated")}
        </p>
      ) : null}
      {subscriptionStatus ? (
        <p className="mt-5 rounded-xl bg-success/10 p-4 font-bold text-success">
          {t("subscriptionCreated")}
        </p>
      ) : null}
      {subscriptionError ? (
        <p className="mt-5 rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {t(`subscriptionErrors.${subscriptionError}` as "subscriptionErrors.create_failed")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {t(`errors.${error}` as "errors.update_failed")}
        </p>
      ) : null}
      <form
        method="get"
        className="mt-7 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_14rem_auto]"
      >
        <Input name="q" defaultValue={data.filters.q} placeholder={t("search")} />
        <select
          name="status"
          defaultValue={data.filters.status}
          className="min-h-11 rounded-xl border bg-background px-3"
        >
          <option value="all">{t("all")}</option>
          {states.map((item) => (
            <option key={item} value={item}>
              {t(`states.${item}`)}
            </option>
          ))}
        </select>
        <Button type="submit">
          <Search aria-hidden="true" />
          {t("filter")}
        </Button>
      </form>
      <div className="mt-6 grid gap-4">
        {data.applications.length ? (
          data.applications.map((application) => {
            const latest = data.placements.find((item) => item.application_id === application.id);
            return (
              <details key={application.id} className="rounded-2xl border bg-card shadow-card">
                <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-black text-primary">{application.student_name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
                      {application.order_no}
                    </p>
                  </div>
                  <Badge
                    variant={
                      application.status === "accepted"
                        ? "success"
                        : application.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {t(`states.${application.status}`)}
                  </Badge>
                </summary>
                <div className="grid gap-6 border-t p-5 lg:grid-cols-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-black text-primary">
                      <ClipboardList className="size-5 text-secondary" />
                      {t("details")}
                    </h2>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <Info label={t("age")} value={String(application.student_age)} />
                      <Info
                        label={t("contact")}
                        value={application.contact_email ?? application.contact_phone ?? "—"}
                      />
                      <Info label={t("timezone")} value={application.timezone} />
                      <Info label={t("level")} value={t(`levels.${application.self_level}`)} />
                      <Info
                        label={t("preferredTimes")}
                        value={(application.preferred_times as string[]).join("، ")}
                      />
                      <Info label={t("source")} value={application.source} />
                    </dl>
                    {application.notes ? (
                      <p className="mt-4 rounded-xl bg-background p-3 text-sm leading-7">
                        {application.notes}
                      </p>
                    ) : null}
                  </div>
                  <form action={updateApplicationAction.bind(null, locale)} className="grid gap-3">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <Label htmlFor={`status-${application.id}`}>{t("workflowStatus")}</Label>
                    <select
                      id={`status-${application.id}`}
                      name="status"
                      defaultValue={application.status}
                      className="min-h-11 rounded-xl border bg-background px-3"
                    >
                      {states.map((item) => (
                        <option key={item} value={item}>
                          {t(`states.${item}`)}
                        </option>
                      ))}
                    </select>
                    <Label htmlFor={`notes-${application.id}`}>{t("internalNotes")}</Label>
                    <textarea
                      id={`notes-${application.id}`}
                      name="internalNotes"
                      defaultValue={application.internal_notes ?? ""}
                      maxLength={5000}
                      className="min-h-24 rounded-xl border bg-background p-3"
                    />
                    <AdminSubmitButton label={t("saveWorkflow")} pendingLabel={t("saving")} />
                  </form>
                  <form
                    action={savePlacementAction.bind(null, locale)}
                    className="grid gap-3 rounded-2xl border bg-background p-4 lg:col-span-2"
                  >
                    <input type="hidden" name="applicationId" value={application.id} />
                    <h2 className="flex items-center gap-2 font-black text-primary">
                      <GraduationCap className="size-5 text-secondary" />
                      {t("placement")}
                    </h2>
                    {latest ? (
                      <p className="text-sm text-muted-foreground">
                        {t("latestScores", {
                          recitation: latest.recitation_score ?? 0,
                          tajweed: latest.tajweed_score ?? 0,
                          memorization: latest.memorization_score ?? 0,
                        })}
                      </p>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Score name="recitationScore" label={t("recitation")} />
                      <Score name="tajweedScore" label={t("tajweed")} />
                      <Score name="memorizationScore" label={t("memorization")} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectRecommendation
                        name="recommendedTrackId"
                        label={t("recommendedTrack")}
                        options={data.tracks.map((item) => ({ id: item.id, name: name(item) }))}
                        empty={t("none")}
                      />
                      <SelectRecommendation
                        name="recommendedPackageId"
                        label={t("recommendedPackage")}
                        options={data.packages.map((item) => ({ id: item.id, name: name(item) }))}
                        empty={t("none")}
                      />
                    </div>
                    <Label htmlFor={`placement-notes-${application.id}`}>
                      {t("placementNotes")}
                    </Label>
                    <textarea
                      id={`placement-notes-${application.id}`}
                      name="notes"
                      maxLength={3000}
                      className="min-h-20 rounded-xl border bg-card p-3"
                    />
                    <AdminSubmitButton
                      label={t("savePlacement")}
                      pendingLabel={t("saving")}
                      variant="outline"
                    />
                  </form>
                  {application.status === "accepted" ? (
                    <div className="flex flex-wrap gap-3 lg:col-span-2">
                      <form action={convertApplicationAction.bind(null, locale)}>
                        <input type="hidden" name="applicationId" value={application.id} />
                        <AdminSubmitButton
                          label={application.converted_student_id ? t("openStudent") : t("convert")}
                          pendingLabel={t("converting")}
                        />
                      </form>
                      {application.converted_student_id &&
                      application.package_id &&
                      application.country_code ? (
                        <form action={createSubscriptionAction.bind(null, locale, true)}>
                          <input type="hidden" name="applicationId" value={application.id} />
                          <input
                            type="hidden"
                            name="studentId"
                            value={application.converted_student_id}
                          />
                          <input type="hidden" name="packageId" value={application.package_id} />
                          <input
                            type="hidden"
                            name="countryCode"
                            value={application.country_code}
                          />
                          <input type="hidden" name="startDate" value={today} />
                          <AdminSubmitButton
                            label={t("createSubscription")}
                            pendingLabel={t("creatingSubscription")}
                            variant="outline"
                          />
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })
        ) : (
          <p className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-bold text-primary">{value}</dd>
    </div>
  );
}
function Score({ name, label }: { name: string; label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={0} max={100} required />
    </div>
  );
}
function SelectRecommendation({
  name,
  label,
  options,
  empty,
}: {
  name: string;
  label: string;
  options: Array<{ id: string; name: string }>;
  empty: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} className="min-h-11 rounded-xl border bg-card px-3">
        <option value="">{empty}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}
