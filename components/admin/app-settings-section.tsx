import { Building2, Clock3, ImageIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { updatePublicAppSettingsAction } from "@/lib/settings/actions";
import { getPublicAppSettings } from "@/lib/settings/public-settings";

type AppSettingsSectionProps = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const textareaClassName =
  "min-h-28 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 sm:text-sm";

export async function AppSettingsSection({ locale, searchParams }: AppSettingsSectionProps) {
  const [query, settings, t] = await Promise.all([
    searchParams,
    getPublicAppSettings(),
    getTranslations({ locale, namespace: "appSettings" }),
  ]);
  const notice = getNotice(query, t);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="app-settings-title">
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {t("eyebrow")}
        </p>
        <h1
          id="app-settings-title"
          className="text-3xl font-black text-balance text-primary sm:text-4xl"
        >
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
      </header>

      <div className="mt-7">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <form action={updatePublicAppSettingsAction.bind(null, locale)} className="mt-8 grid gap-6">
        <fieldset className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
          <legend className="sr-only">{t("profile.title")}</legend>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-secondary">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("profile.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("profile.description")}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <LocalizedFields
              language="ar"
              name="nameAr"
              descriptionName="descriptionAr"
              nameValue={settings.academyProfile.nameAr}
              descriptionValue={settings.academyProfile.descriptionAr}
              t={t}
            />
            <LocalizedFields
              language="en"
              name="nameEn"
              descriptionName="descriptionEn"
              nameValue={settings.academyProfile.nameEn}
              descriptionValue={settings.academyProfile.descriptionEn}
              t={t}
            />
          </div>

          <div className="mt-5 grid gap-2">
            <Label htmlFor="app-logo-path" className="inline-flex items-center gap-2">
              <ImageIcon className="size-4" aria-hidden="true" />
              {t("fields.logoPath")}
            </Label>
            <Input
              id="app-logo-path"
              name="logoPath"
              dir="ltr"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={2048}
              placeholder="/images/academy-logo.png"
              defaultValue={settings.academyProfile.logoPath ?? ""}
            />
            <p className="text-xs leading-6 text-muted-foreground">{t("fields.logoPathHint")}</p>
          </div>
        </fieldset>

        <fieldset className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
          <legend className="sr-only">{t("support.title")}</legend>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
              <Clock3 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("support.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("support.description")}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="support-hours-ar">{t("fields.supportHoursAr")}</Label>
              <textarea
                id="support-hours-ar"
                name="supportHoursAr"
                dir="rtl"
                maxLength={500}
                required
                className={textareaClassName}
                defaultValue={settings.supportHours.ar}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="support-hours-en">{t("fields.supportHoursEn")}</Label>
              <textarea
                id="support-hours-en"
                name="supportHoursEn"
                dir="ltr"
                maxLength={500}
                required
                className={textareaClassName}
                defaultValue={settings.supportHours.en}
              />
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <AdminSubmitButton label={t("action.save")} pendingLabel={t("action.saving")} />
        </div>
      </form>
    </section>
  );
}

type Translation = Awaited<ReturnType<typeof getTranslations<"appSettings">>>;

function LocalizedFields({
  language,
  name,
  descriptionName,
  nameValue,
  descriptionValue,
  t,
}: {
  language: "ar" | "en";
  name: "nameAr" | "nameEn";
  descriptionName: "descriptionAr" | "descriptionEn";
  nameValue: string;
  descriptionValue: string;
  t: Translation;
}) {
  const direction = language === "ar" ? "rtl" : "ltr";

  return (
    <div className="grid gap-4 rounded-2xl border bg-background/55 p-4 sm:p-5">
      <h3 className="font-black text-primary">{t(`languages.${language}`)}</h3>
      <div className="grid gap-2">
        <Label htmlFor={`academy-${name}`}>{t(`fields.${name}`)}</Label>
        <Input
          id={`academy-${name}`}
          name={name}
          dir={direction}
          maxLength={120}
          required
          defaultValue={nameValue}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`academy-${descriptionName}`}>{t(`fields.${descriptionName}`)}</Label>
        <textarea
          id={`academy-${descriptionName}`}
          name={descriptionName}
          dir={direction}
          maxLength={500}
          required
          className={textareaClassName}
          defaultValue={descriptionValue}
        />
      </div>
    </div>
  );
}

function getNotice(query: Record<string, string | string[] | undefined>, t: Translation) {
  const status = typeof query.settingStatus === "string" ? query.settingStatus : undefined;
  const error = typeof query.settingError === "string" ? query.settingError : undefined;

  if (status === "updated") return { message: t("notices.updated"), success: true };
  if (error === "invalid_fields") return { message: t("errors.invalidFields"), success: false };
  if (error === "request_failed") return { message: t("errors.requestFailed"), success: false };
  return { message: undefined, success: false };
}
