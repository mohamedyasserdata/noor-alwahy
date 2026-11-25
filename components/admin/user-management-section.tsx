import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AccountRoleFields } from "@/components/admin/account-role-fields";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { createManagedAccountAction, setAccountActiveAction } from "@/lib/admin/user-actions";
import { getManagedAccountSetupOptions, getManagedUsers } from "@/lib/admin/user-management";

type UserManagementSectionProps = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function UserManagementSection({ locale, searchParams }: UserManagementSectionProps) {
  const [query, users, options, t] = await Promise.all([
    searchParams,
    getManagedUsers(),
    getManagedAccountSetupOptions(),
    getTranslations({ locale, namespace: "userManagement" }),
  ]);
  const notice = getNotice(query, t);
  const today = new Date().toISOString().slice(0, 10);
  const localName = (row: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? row.name_ar : (row.name_en ?? row.name_ar);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="users-title">
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {t("eyebrow")}
        </p>
        <h1 id="users-title" className="text-3xl font-black text-balance text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
      </header>

      <div className="mt-7">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
        <article className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-secondary">
              <UserPlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("create.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("create.description")}</p>
            </div>
          </div>

          <form
            action={createManagedAccountAction.bind(null, locale)}
            className="group mt-6 grid gap-4"
            data-account-role="student"
          >
            <div className="grid gap-2">
              <Label htmlFor="fullName">{t("fields.fullName")}</Label>
              <Input id="fullName" name="fullName" autoComplete="name" maxLength={160} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountEmail">{t("fields.email")}</Label>
              <Input
                id="accountEmail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <AccountRoleFields
                locale={locale}
                roleLabels={{
                  admin: t("roles.admin"),
                  teacher: t("roles.teacher"),
                  student: t("roles.student"),
                  parent: t("roles.parent"),
                }}
                students={options.students.map((student) => ({
                  id: student.id,
                  full_name: student.full_name,
                  student_no: student.student_no,
                }))}
              />
              <div className="grid gap-2">
                <Label htmlFor="mode">{t("fields.mode")}</Label>
                <select
                  id="mode"
                  name="mode"
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                  defaultValue="invite"
                >
                  <option value="invite">{t("modes.invite")}</option>
                  <option value="password">{t("modes.password")}</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountGender">{t("fields.gender")}</Label>
              <select
                id="accountGender"
                name="gender"
                className="h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                defaultValue="male"
              >
                <option value="male">{t("genders.male")}</option>
                <option value="female">{t("genders.female")}</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="temporaryPassword">{t("fields.temporaryPassword")}</Label>
              <Input
                id="temporaryPassword"
                name="temporaryPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
              />
              <p className="text-xs leading-6 text-muted-foreground">{t("fields.passwordHint")}</p>
            </div>
            <details className="hidden rounded-2xl border bg-background/60 p-4 group-data-[account-role=student]:block">
              <summary className="cursor-pointer font-black text-primary">
                {locale === "ar"
                  ? "إعداد الطالب: الاشتراك والموعد"
                  : "Student setup: subscription and time"}
              </summary>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {locale === "ar"
                  ? "املأ هذا الجزء عند إنشاء حساب طالب. بعد الحفظ ستظهر لك قائمة المعلمين المتاحين في الموعد المختار ثم باقي المعلمين."
                  : "Complete this when creating a student. After saving, available teachers for the selected time appear first, followed by the remaining teachers."}
              </p>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="account-package">{locale === "ar" ? "الباقة" : "Package"}</Label>
                  <select
                    id="account-package"
                    name="packageId"
                    defaultValue={options.packages[0]?.id ?? ""}
                    className="min-h-11 rounded-xl border bg-card px-3"
                  >
                    <option value="">{locale === "ar" ? "تُحدد لاحقًا" : "Set later"}</option>
                    {options.packages.map((item) => (
                      <option key={item.id} value={item.id}>
                        {localName(item)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="account-country">
                      {locale === "ar" ? "دولة التسعير" : "Pricing country"}
                    </Label>
                    <select
                      id="account-country"
                      name="countryCode"
                      defaultValue={
                        options.countries.find((item) => item.code === "EG")?.code ??
                        options.countries[0]?.code ??
                        ""
                      }
                      className="min-h-11 rounded-xl border bg-card px-3"
                    >
                      <option value="">{locale === "ar" ? "اختر الدولة" : "Choose country"}</option>
                      {options.countries.map((item) => (
                        <option key={item.code} value={item.code}>
                          {localName(item)} · {item.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="account-start">
                      {locale === "ar" ? "بداية الاشتراك" : "Subscription start"}
                    </Label>
                    <Input id="account-start" name="startDate" type="date" defaultValue={today} />
                  </div>
                </div>
                <fieldset className="grid gap-2">
                  <legend className="font-bold text-primary">
                    {locale === "ar" ? "أيام الحصص" : "Lesson days"}
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <label
                        key={day}
                        className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold has-[:checked]:border-secondary has-[:checked]:bg-secondary/10"
                      >
                        <input
                          type="checkbox"
                          name="weekdays"
                          value={day}
                          className="size-4 accent-primary"
                        />
                        {
                          (locale === "ar"
                            ? [
                                "الأحد",
                                "الاثنين",
                                "الثلاثاء",
                                "الأربعاء",
                                "الخميس",
                                "الجمعة",
                                "السبت",
                              ]
                            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])[day]
                        }
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="account-time">
                      {locale === "ar" ? "وقت البداية بتوقيت مصر" : "Start time (Cairo)"}
                    </Label>
                    <Input id="account-time" name="localStartTime" type="time" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="account-duration">
                      {locale === "ar" ? "مدة الحصة" : "Duration"}
                    </Label>
                    <select
                      id="account-duration"
                      name="durationMin"
                      defaultValue="45"
                      className="min-h-11 rounded-xl border bg-card px-3"
                    >
                      {[30, 45, 60, 90].map((value) => (
                        <option key={value} value={value}>
                          {value} {locale === "ar" ? "دقيقة" : "minutes"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </details>
            <details className="hidden rounded-2xl border bg-background/60 p-4 group-data-[account-role=teacher]:block">
              <summary className="cursor-pointer font-black text-primary">
                {locale === "ar" ? "إعداد المعلم: أوقات التفرغ" : "Teacher setup: availability"}
              </summary>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {locale === "ar"
                  ? "املأ هذا الجزء عند إنشاء حساب معلم فقط. تظهر هذه الأوقات للإدارة عند تعيين الطلاب."
                  : "Complete this only for a teacher account. These times are used when assigning students."}
              </p>
              <div className="mt-4 grid gap-4">
                <fieldset className="grid gap-2">
                  <legend className="font-bold text-primary">
                    {locale === "ar" ? "الأيام المتاحة" : "Available days"}
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <label
                        key={day}
                        className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold has-[:checked]:border-secondary has-[:checked]:bg-secondary/10"
                      >
                        <input
                          type="checkbox"
                          name="teacherWeekdays"
                          value={day}
                          className="size-4 accent-primary"
                        />
                        {
                          (locale === "ar"
                            ? [
                                "الأحد",
                                "الاثنين",
                                "الثلاثاء",
                                "الأربعاء",
                                "الخميس",
                                "الجمعة",
                                "السبت",
                              ]
                            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])[day]
                        }
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="teacher-start">
                      {locale === "ar" ? "متاح من" : "Available from"}
                    </Label>
                    <Input id="teacher-start" name="teacherStartTime" type="time" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="teacher-end">
                      {locale === "ar" ? "متاح حتى" : "Available until"}
                    </Label>
                    <Input id="teacher-end" name="teacherEndTime" type="time" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {locale === "ar" ? "جميع الأوقات بتوقيت مصر." : "All times use Cairo time."}
                </p>
              </div>
            </details>
            <AdminSubmitButton label={t("create.action")} pendingLabel={t("create.pending")} />
          </form>
        </article>

        <article className="min-w-0 rounded-3xl border bg-card p-5 shadow-card sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
                <Users className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-black text-primary">{t("list.title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("list.count", { count: users.length })}
                </p>
              </div>
            </div>
            <ShieldCheck className="size-6 shrink-0 text-success" aria-hidden="true" />
          </div>

          <div className="mt-6 grid gap-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="grid min-w-0 gap-4 rounded-2xl border bg-background/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold break-words text-foreground">{user.fullName}</p>
                    <Badge variant={user.isActive ? "success" : "outline"}>
                      {user.isActive ? t("status.active") : t("status.inactive")}
                    </Badge>
                    <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>
                  </div>
                  <p className="mt-2 text-sm break-all text-muted-foreground" dir="ltr">
                    {user.email ?? t("list.noEmail")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("list.createdAt", {
                      value: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                        new Date(user.createdAt),
                      ),
                    })}
                  </p>
                </div>
                <form action={setAccountActiveAction.bind(null, locale)}>
                  <input type="hidden" name="profileId" value={user.id} />
                  <input type="hidden" name="isActive" value={String(!user.isActive)} />
                  <AdminSubmitButton
                    label={user.isActive ? t("actions.disable") : t("actions.activate")}
                    pendingLabel={t("actions.pending")}
                    variant={user.isActive ? "destructive" : "outline"}
                  />
                </form>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function getNotice(
  query: Record<string, string | string[] | undefined>,
  t: Awaited<ReturnType<typeof getTranslations<"userManagement">>>,
) {
  const status = typeof query.status === "string" ? query.status : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;
  const statusKeys = {
    activated: "notices.activated",
    created: "notices.created",
    disabled: "notices.disabled",
    invited: "notices.invited",
  } as const;
  const errorKeys = {
    account_exists: "errors.accountExists",
    cannot_disable_self: "errors.cannotDisableSelf",
    invalid_fields: "errors.invalidFields",
    request_failed: "errors.requestFailed",
    setup_failed: "errors.requestFailed",
  } as const;

  if (status && status in statusKeys) {
    return { message: t(statusKeys[status as keyof typeof statusKeys]), success: true };
  }

  if (error && error in errorKeys) {
    return { message: t(errorKeys[error as keyof typeof errorKeys]), success: false };
  }

  return { message: undefined, success: false };
}
