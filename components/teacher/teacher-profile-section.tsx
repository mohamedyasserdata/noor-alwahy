import { Bell, Languages, Moon, Settings2, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { TeacherPageHeader, TeacherPanel } from "@/components/teacher/teacher-page-ui";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneField } from "@/components/time/timezone-field";
import type { AppLocale } from "@/i18n/routing";
import { saveTeacherProfileAction } from "@/lib/account/teacher-profile-actions";
import { getTeacherProfileSettings } from "@/lib/account/teacher-profile";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function TeacherProfileSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "teacherReference.profile" }),
    getTeacherProfileSettings(),
    searchParams,
  ]);
  if (!data) return <Alert variant="warning">{t("missing")}</Alert>;

  return (
    <section className="teacher-reference-page">
      <TeacherPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        icon={Settings2}
      />
      {query.profileStatus === "saved" ? (
        <Alert variant="success" className="mt-5" aria-live="polite">
          {t("saved")}
        </Alert>
      ) : null}
      {query.profileError ? (
        <Alert variant="warning" className="mt-5" aria-live="polite">
          {t("saveError")}
        </Alert>
      ) : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <TeacherPanel title={t("detailsTitle")}>
          <form
            action={saveTeacherProfileAction.bind(null, locale)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label={t("displayName")} id="teacher-display-name">
              <Input
                id="teacher-display-name"
                name="displayName"
                defaultValue={data.profile.display_name ?? data.profile.full_name}
                autoComplete="name"
                required
              />
            </Field>
            <Field label={t("email")} id="teacher-email">
              <Input
                id="teacher-email"
                type="email"
                value={data.email}
                readOnly
                spellCheck={false}
              />
            </Field>
            <Field label={t("language")} id="teacher-preferred-locale">
              <select
                id="teacher-preferred-locale"
                name="preferredLocale"
                defaultValue={data.profile.preferred_locale}
                className="min-h-11 w-full rounded-xl border bg-card px-3 text-foreground"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Field>
            <TimezoneField
              id="teacher-timezone"
              label={t("timezone")}
              initialValue={data.profile.timezone}
              locale={locale}
            />
            <div className="sm:col-span-2 sm:flex sm:justify-end">
              <AdminSubmitButton label={t("save")} pendingLabel={t("saving")} />
            </div>
          </form>
        </TeacherPanel>

        <TeacherPanel title={t("preferencesTitle")}>
          <ul className="divide-y divide-secondary/15">
            <Preference icon={Bell} title={t("notifications")} detail={t("notificationsDetail")} />
            <Preference icon={Moon} title={t("appearance")} detail={t("appearanceDetail")} />
            <Preference icon={Languages} title={t("language")} detail={t("languageDetail")} />
            <Preference icon={UserRound} title={t("account")} detail={t("accountDetail")} />
          </ul>
        </TeacherPanel>
      </div>
    </section>
  );
}

function Field({ children, id, label }: { children: React.ReactNode; id: string; label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Preference({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Bell;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff0d1] text-[#a76600] dark:bg-[#493716] dark:text-[#f0c462]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-black text-primary">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}
