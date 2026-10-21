import { Megaphone, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  archiveAnnouncementAction,
  publishAnnouncementAction,
  saveAnnouncementAction,
} from "@/lib/announcements/actions";
import { getAnnouncementAdminData, type AnnouncementAdminData } from "@/lib/announcements/queries";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function AnnouncementAdminSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Search;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "announcements" }),
    getAnnouncementAdminData(),
    searchParams,
  ]);
  const editId = typeof query.edit === "string" ? query.edit : "";
  const draft = data.announcements.find((item) => item.id === editId && item.status === "draft");
  const status = typeof query.announcementStatus === "string" ? query.announcementStatus : "";
  const error = typeof query.announcementError === "string" ? query.announcementError : "";
  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="announcements-title">
      <header className="max-w-3xl">
        <p className="mb-3 flex items-center gap-2 text-sm font-black text-secondary">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t("eyebrow")}
        </p>
        <h1 id="announcements-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      {status ? (
        <Alert className="mt-6" variant="success">
          {status === "published"
            ? t("feedback.published", { count: Number(query.delivered ?? 0) })
            : t(`feedback.${status}`)}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t("feedback.error")}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <AnnouncementForm locale={locale} data={data} draft={draft} />
        <div>
          <h2 className="text-xl font-black text-primary">{t("list.title")}</h2>
          <div className="mt-4 grid gap-4">
            {data.announcements.length ? (
              data.announcements.map((item) => (
                <article key={item.id} className="rounded-3xl border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-primary">
                        {locale === "ar" || !item.titleEn ? item.titleAr : item.titleEn}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.createdAt))}
                      </p>
                    </div>
                    <Badge variant={item.status === "published" ? "success" : "secondary"}>
                      {t(`statuses.${item.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">
                    {locale === "ar" || !item.bodyEn ? item.bodyAr : item.bodyEn}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      {item.audience.all
                        ? t("audience.all")
                        : t("audience.filters", {
                            count:
                              (item.audience.roles?.length ?? 0) +
                              (item.audience.countries?.length ?? 0) +
                              (item.audience.level_ids?.length ?? 0) +
                              (item.audience.track_ids?.length ?? 0),
                          })}
                    </Badge>
                    {item.status !== "draft" ? (
                      <Badge variant="outline">
                        {t("list.delivered", { count: item.deliveryCount })}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.status === "draft" ? (
                      <>
                        <Button asChild size="sm" variant="outline">
                          <a href={`/${locale}/admin/announcements?edit=${item.id}`}>
                            {t("actions.edit")}
                          </a>
                        </Button>
                        <form action={publishAnnouncementAction.bind(null, locale)}>
                          <input type="hidden" name="announcementId" value={item.id} />
                          <AdminSubmitButton
                            label={t("actions.publish")}
                            pendingLabel={t("actions.publishing")}
                          />
                        </form>
                      </>
                    ) : null}
                    {item.status === "published" ? (
                      <form action={archiveAnnouncementAction.bind(null, locale)}>
                        <input type="hidden" name="announcementId" value={item.id} />
                        <AdminSubmitButton
                          label={t("actions.archive")}
                          pendingLabel={t("actions.archiving")}
                          variant="outline"
                        />
                      </form>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
                {t("list.empty")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

async function AnnouncementForm({
  locale,
  data,
  draft,
}: {
  locale: AppLocale;
  data: AnnouncementAdminData;
  draft: AnnouncementAdminData["announcements"][number] | undefined;
}) {
  const t = await getTranslations({ locale, namespace: "announcements" });
  return (
    <form
      action={saveAnnouncementAction.bind(null, locale)}
      className="h-fit rounded-3xl border bg-card p-5 shadow-card sm:p-7"
    >
      <input type="hidden" name="announcementId" value={draft?.id ?? ""} />
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-primary text-secondary">
          <Megaphone aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-black text-primary">
            {draft ? t("form.editTitle") : t("form.createTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("form.draftNotice")}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label={t("form.titleAr")} name="titleAr" value={draft?.titleAr} required />
        <Field label={t("form.titleEn")} name="titleEn" value={draft?.titleEn ?? ""} />
        <TextArea label={t("form.bodyAr")} name="bodyAr" value={draft?.bodyAr} required />
        <TextArea label={t("form.bodyEn")} name="bodyEn" value={draft?.bodyEn ?? ""} />
      </div>
      <fieldset className="mt-6 rounded-2xl border p-4">
        <legend className="px-2 font-black text-primary">{t("form.audience")}</legend>
        <label className="flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" name="all" defaultChecked={draft?.audience.all ?? true} />
          {t("form.all")}
        </label>
        <p className="text-xs text-muted-foreground">{t("form.allHint")}</p>
        <OptionGroup
          label={t("form.roles")}
          name="roles"
          options={(["admin", "teacher", "student", "parent"] as const).map((value) => ({
            value,
            label: t(`roles.${value}`),
          }))}
          selected={draft?.audience.roles}
        />
        <OptionGroup
          label={t("form.countries")}
          name="countries"
          options={data.countries.map((item) => ({
            value: item.code,
            label: locale === "ar" || !item.name_en ? item.name_ar : item.name_en,
          }))}
          selected={draft?.audience.countries}
        />
        <OptionGroup
          label={t("form.levels")}
          name="levelIds"
          options={data.levels.map((item) => ({
            value: item.id,
            label: locale === "ar" || !item.name_en ? item.name_ar : item.name_en,
          }))}
          selected={draft?.audience.level_ids}
        />
        <OptionGroup
          label={t("form.tracks")}
          name="trackIds"
          options={data.tracks.map((item) => ({
            value: item.id,
            label: locale === "ar" || !item.name_en ? item.name_ar : item.name_en,
          }))}
          selected={draft?.audience.track_ids}
        />
      </fieldset>
      <div className="mt-5 grid gap-2">
        <Label htmlFor="announcement-ends-on">{t("form.endsOn")}</Label>
        <Input
          id="announcement-ends-on"
          name="endsOn"
          type="date"
          defaultValue={draft?.endsAt?.slice(0, 10) ?? ""}
          dir="ltr"
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <AdminSubmitButton label={t("actions.save")} pendingLabel={t("actions.saving")} />
        {draft ? (
          <Button asChild variant="outline">
            <a href={`/${locale}/admin/announcements`}>{t("actions.cancel")}</a>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  value = "",
  required = false,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`announcement-${name}`}>{label}</Label>
      <Input id={`announcement-${name}`} name={name} defaultValue={value} required={required} />
    </div>
  );
}
function TextArea({
  label,
  name,
  value = "",
  required = false,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`announcement-${name}`}>{label}</Label>
      <textarea
        id={`announcement-${name}`}
        name={name}
        defaultValue={value}
        required={required}
        rows={6}
        className="min-h-32 rounded-xl border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
function OptionGroup({
  label,
  name,
  options,
  selected = [],
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selected?: string[];
}) {
  if (!options.length) return null;
  return (
    <details className="mt-4 rounded-xl border p-3">
      <summary className="cursor-pointer font-bold">{label}</summary>
      <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </details>
  );
}
