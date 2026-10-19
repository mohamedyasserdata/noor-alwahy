import { Archive, Download, GraduationCap, Search, UserRoundPlus, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { archiveStudentAction, saveStudentAction } from "@/lib/students/actions";
import {
  createFamilyAccountAction,
  removeGuardianLinkAction,
  saveGuardianLinkAction,
} from "@/lib/students/family-actions";
import { getStudentFamily, type StudentFamily } from "@/lib/students/student-family";
import {
  getStudentDirectory,
  getStudentForEditing,
  type StudentListItem,
} from "@/lib/students/student-management";

type Props = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const textareaClass =
  "min-h-24 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25";

export async function StudentManagementSection({ locale, searchParams }: Props) {
  const query = await searchParams;
  const selectedId = typeof query.student === "string" ? query.student : null;
  const [directory, selected, family, t] = await Promise.all([
    getStudentDirectory(query, locale),
    selectedId ? getStudentForEditing(selectedId, locale) : Promise.resolve(null),
    selectedId ? getStudentFamily(selectedId) : Promise.resolve(null),
    getTranslations({ locale, namespace: "studentManagement" }),
  ]);
  const notice = getNotice(query, t);
  const exportQuery = new URLSearchParams();
  for (const key of ["q", "status", "level", "country"] as const) {
    const value = directory.filters[key];
    if (value && value !== "all") exportQuery.set(key, String(value));
  }

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="students-title">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-extrabold text-secondary">{t("eyebrow")}</p>
          <h1
            id="students-title"
            className="text-3xl font-black text-balance text-primary sm:text-4xl"
          >
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild variant="outline">
          <a href={`/${locale}/admin/students/export?${exportQuery}`}>
            <Download aria-hidden="true" />
            {t("export")}
          </a>
        </Button>
      </header>

      <div className="mt-7">
        <AuthNotice message={notice.message} success={notice.success} />
      </div>

      <form
        method="get"
        className="mt-8 grid gap-3 rounded-2xl border bg-card p-4 shadow-card md:grid-cols-[minmax(12rem,1.4fr)_repeat(3,minmax(8rem,0.7fr))_auto]"
      >
        <div className="grid gap-2">
          <Label htmlFor="student-search">{t("filters.search")}</Label>
          <Input
            id="student-search"
            name="q"
            defaultValue={directory.filters.q}
            placeholder={t("filters.searchPlaceholder")}
          />
        </div>
        <FilterSelect
          id="student-status"
          name="status"
          label={t("filters.status")}
          defaultValue={directory.filters.status}
        >
          <option value="all">{t("filters.all")}</option>
          {(["active", "dropped", "graduated", "suspended", "archived"] as const).map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="student-level"
          name="level"
          label={t("filters.level")}
          defaultValue={directory.filters.level}
        >
          <option value="all">{t("filters.all")}</option>
          {directory.levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.track} · {level.label}
            </option>
          ))}
        </FilterSelect>
        <div className="grid gap-2">
          <Label htmlFor="student-country">{t("filters.country")}</Label>
          <Input
            id="student-country"
            name="country"
            dir="ltr"
            maxLength={2}
            defaultValue={directory.filters.country}
            placeholder="EG"
          />
        </div>
        <Button type="submit" className="self-end">
          <Search aria-hidden="true" />
          {t("filters.apply")}
        </Button>
      </form>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
        <article className="min-w-0 rounded-3xl border bg-card p-5 shadow-card sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-primary">{t("list.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("list.count", { count: directory.total })}
              </p>
            </div>
            <GraduationCap className="size-6 text-secondary" aria-hidden="true" />
          </div>
          {directory.students.length ? (
            <ul className="mt-6 grid gap-3">
              {directory.students.map((student) => (
                <StudentRow key={student.id} student={student} locale={locale} t={t} />
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              {t("list.empty")}
            </p>
          )}
          <nav
            className="mt-6 flex items-center justify-between gap-3"
            aria-label={t("pagination.label")}
          >
            <PageLink
              locale={locale}
              query={query}
              page={directory.filters.page - 1}
              disabled={directory.filters.page <= 1}
            >
              {t("pagination.previous")}
            </PageLink>
            <span className="text-sm font-bold text-muted-foreground">
              {t("pagination.current", {
                page: directory.filters.page,
                pages: directory.pageCount,
              })}
            </span>
            <PageLink
              locale={locale}
              query={query}
              page={directory.filters.page + 1}
              disabled={directory.filters.page >= directory.pageCount}
            >
              {t("pagination.next")}
            </PageLink>
          </nav>
        </article>

        <StudentForm locale={locale} student={selected} levels={directory.levels} t={t} />
      </div>

      {selected ? (
        <div className="mt-6 grid gap-6">
          <ProfileSkeleton student={selected} t={t} />
          {family ? (
            <FamilyManagement locale={locale} student={selected} family={family} t={t} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StudentRow({
  student,
  locale,
  t,
}: {
  student: StudentListItem;
  locale: AppLocale;
  t: Translation;
}) {
  return (
    <li className="grid gap-4 rounded-2xl border bg-background/55 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-primary">{student.fullName}</p>
          <Badge variant={student.status === "active" ? "success" : "outline"}>
            {t(`statuses.${student.status}`)}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          <bdi>{student.studentNo}</bdi> · {student.levelName ?? t("list.noLevel")}
          {student.countryCode ? ` · ${student.countryCode}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/${locale}/admin/students?student=${student.id}`}>{t("actions.open")}</a>
        </Button>
        {student.status !== "archived" ? (
          <form action={archiveStudentAction.bind(null, locale)}>
            <input type="hidden" name="studentId" value={student.id} />
            <AdminSubmitButton
              label={t("actions.archive")}
              pendingLabel={t("actions.archiving")}
              variant="destructive"
            />
          </form>
        ) : null}
      </div>
    </li>
  );
}

function StudentForm({
  locale,
  student,
  levels,
  t,
}: {
  locale: AppLocale;
  student: Awaited<ReturnType<typeof getStudentForEditing>>;
  levels: { id: string; label: string; track: string | null }[];
  t: Translation;
}) {
  return (
    <article className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-secondary">
          <UserRoundPlus aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-black text-primary">
            {student ? t("form.editTitle") : t("form.createTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("form.description")}</p>
        </div>
      </div>
      <form action={saveStudentAction.bind(null, locale)} className="mt-6 grid gap-4">
        {student ? <input type="hidden" name="studentId" value={student.id} /> : null}
        <Field
          id="student-name"
          name="fullName"
          label={t("fields.fullName")}
          defaultValue={student?.fullName}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FilterSelect
            id="student-gender"
            name="gender"
            label={t("fields.gender")}
            defaultValue={student?.gender ?? "male"}
          >
            <option value="male">{t("genders.male")}</option>
            <option value="female">{t("genders.female")}</option>
          </FilterSelect>
          <FilterSelect
            id="student-edit-status"
            name="status"
            label={t("fields.status")}
            defaultValue={student?.status ?? "active"}
          >
            {(["active", "dropped", "graduated", "suspended", "archived"] as const).map(
              (status) => (
                <option key={status} value={status}>
                  {t(`statuses.${status}`)}
                </option>
              ),
            )}
          </FilterSelect>
        </div>
        <FilterSelect
          id="student-edit-level"
          name="levelId"
          label={t("fields.level")}
          defaultValue={student?.levelId ?? ""}
        >
          <option value="">{t("list.noLevel")}</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.track} · {level.label}
            </option>
          ))}
        </FilterSelect>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="student-birth"
            name="birthDate"
            type="date"
            label={t("fields.birthDate")}
            defaultValue={student?.birthDate ?? ""}
          />
          <Field
            id="student-joined"
            name="joinedAt"
            type="date"
            label={t("fields.joinedAt")}
            defaultValue={student?.joinedAt ?? ""}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="student-country-edit"
            name="countryCode"
            label={t("fields.country")}
            defaultValue={student?.countryCode ?? ""}
            dir="ltr"
            maxLength={2}
          />
          <Field
            id="student-timezone"
            name="timezone"
            label={t("fields.timezone")}
            defaultValue={student?.timezone ?? "Africa/Cairo"}
            dir="ltr"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="student-health">{t("fields.healthNotes")}</Label>
          <textarea
            id="student-health"
            name="healthNotes"
            maxLength={2000}
            defaultValue={student?.healthNotes ?? ""}
            className={textareaClass}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="student-special">{t("fields.specialNotes")}</Label>
          <textarea
            id="student-special"
            name="specialNotes"
            maxLength={2000}
            defaultValue={student?.specialNotes ?? ""}
            className={textareaClass}
          />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            name="shareWithTeacher"
            defaultChecked={student?.shareWithTeacher ?? false}
            className="size-5 accent-primary"
          />
          {t("fields.shareWithTeacher")}
        </label>
        <AdminSubmitButton
          label={student ? t("actions.save") : t("actions.create")}
          pendingLabel={t("actions.saving")}
        />
      </form>
    </article>
  );
}

function ProfileSkeleton({
  student,
  t,
}: {
  student: NonNullable<Awaited<ReturnType<typeof getStudentForEditing>>>;
  t: Translation;
}) {
  const tabs = [
    "data",
    "assignments",
    "schedule",
    "attendance",
    "progress",
    "grades",
    "finance",
    "certificates",
  ] as const;
  return (
    <article className="mt-6 rounded-3xl border bg-card p-6 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <Archive className="size-6 text-secondary" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-black text-primary">
            {t("profile.title", { name: student.fullName })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.description")}</p>
        </div>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((tab, index) => (
          <li key={tab} className="rounded-xl border bg-background/60 p-4">
            <p className="font-black text-primary">{t(`profile.tabs.${tab}`)}</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {index === 0 ? t("profile.available") : t("profile.later")}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FamilyManagement({
  locale,
  student,
  family,
  t,
}: {
  locale: AppLocale;
  student: NonNullable<Awaited<ReturnType<typeof getStudentForEditing>>>;
  family: StudentFamily;
  t: Translation;
}) {
  const linkedProfiles = new Set(family.guardianLinks.map(({ profileId }) => profileId));
  const availableParents = family.parentOptions.filter(
    ({ profileId }) => !linkedProfiles.has(profileId),
  );
  return (
    <article
      className="rounded-3xl border bg-card p-6 shadow-card sm:p-7"
      aria-labelledby="student-family-title"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
          <UsersRound aria-hidden="true" />
        </span>
        <div>
          <h2 id="student-family-title" className="text-xl font-black text-primary">
            {t("family.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("family.description")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-background/55 p-5">
          <h3 className="font-black text-primary">{t("family.studentAccount")}</h3>
          {family.studentAccount ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {family.studentAccount.email ?? t("family.accountLinked")}
            </p>
          ) : (
            <AccountForm
              locale={locale}
              studentId={student.id}
              fullName={student.fullName}
              role="student"
              t={t}
            />
          )}
        </section>

        <section className="rounded-2xl border bg-background/55 p-5">
          <h3 className="font-black text-primary">{t("family.createParent")}</h3>
          <AccountForm locale={locale} studentId={student.id} fullName="" role="parent" t={t} />
        </section>
      </div>

      <section className="mt-6 rounded-2xl border bg-background/55 p-5">
        <h3 className="font-black text-primary">{t("family.guardians")}</h3>
        {family.guardianLinks.length ? (
          <ul className="mt-4 grid gap-3">
            {family.guardianLinks.map((link) => (
              <li
                key={link.guardianId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
              >
                <div>
                  <p className="font-bold text-primary">{link.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {link.email ?? t("family.noEmail")} · {link.relation ?? t("family.noRelation")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {link.isPrimary ? (
                      <Badge variant="secondary">{t("family.primary")}</Badge>
                    ) : null}
                    {link.isPayer ? <Badge variant="outline">{t("family.payer")}</Badge> : null}
                  </div>
                </div>
                <form action={removeGuardianLinkAction.bind(null, locale)}>
                  <input type="hidden" name="studentId" value={student.id} />
                  <input type="hidden" name="guardianId" value={link.guardianId} />
                  <AdminSubmitButton
                    label={t("family.unlink")}
                    pendingLabel={t("family.unlinking")}
                    variant="destructive"
                  />
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("family.empty")}</p>
        )}

        {availableParents.length ? (
          <form
            action={saveGuardianLinkAction.bind(null, locale)}
            className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2"
          >
            <input type="hidden" name="studentId" value={student.id} />
            <FilterSelect
              id="existing-parent"
              name="parentProfileId"
              label={t("family.existingParent")}
            >
              <option value="">{t("family.chooseParent")}</option>
              {availableParents.map((parent) => (
                <option key={parent.profileId} value={parent.profileId}>
                  {parent.fullName}
                  {parent.email ? ` — ${parent.email}` : ""}
                </option>
              ))}
            </FilterSelect>
            <Field
              id="existing-relation"
              name="relation"
              label={t("family.relation")}
              maxLength={80}
            />
            <FamilyFlags t={t} />
            <AdminSubmitButton label={t("family.link")} pendingLabel={t("family.linking")} />
          </form>
        ) : null}
      </section>
    </article>
  );
}

function AccountForm({
  locale,
  studentId,
  fullName,
  role,
  t,
}: {
  locale: AppLocale;
  studentId: string;
  fullName: string;
  role: "student" | "parent";
  t: Translation;
}) {
  return (
    <form action={createFamilyAccountAction.bind(null, locale)} className="mt-4 grid gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="role" value={role} />
      <Field
        id={`${role}-account-name`}
        name="fullName"
        label={t("fields.fullName")}
        defaultValue={fullName}
        required
      />
      <Field
        id={`${role}-account-email`}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        label={t("family.email")}
        required
      />
      <Field
        id={`${role}-account-password`}
        name="temporaryPassword"
        type="password"
        autoComplete="new-password"
        minLength={12}
        label={t("family.password")}
        required
      />
      {role === "parent" ? (
        <>
          <Field
            id="new-parent-relation"
            name="relation"
            label={t("family.relation")}
            maxLength={80}
          />
          <FamilyFlags t={t} />
        </>
      ) : (
        <>
          <input type="hidden" name="isPrimary" value="false" />
          <input type="hidden" name="isPayer" value="false" />
        </>
      )}
      <AdminSubmitButton
        label={role === "parent" ? t("family.createParentAction") : t("family.createStudentAction")}
        pendingLabel={t("family.creating")}
      />
    </form>
  );
}

function FamilyFlags({ t }: { t: Translation }) {
  return (
    <div className="flex flex-wrap gap-5 sm:col-span-2">
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="isPrimary" className="size-5 accent-primary" />
        {t("family.primary")}
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="isPayer" className="size-5 accent-primary" />
        {t("family.payer")}
      </label>
    </div>
  );
}

function FilterSelect({
  id,
  name,
  label,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
    </div>
  );
}
function Field(props: React.ComponentProps<typeof Input> & { label: string }) {
  const { id, label, ...input } = props;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  );
}
function PageLink({
  locale,
  query,
  page,
  disabled,
  children,
}: {
  locale: AppLocale;
  query: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (key !== "student" && typeof value === "string") params.set(key, value);
  params.set("page", String(page));
  return disabled ? (
    <span className="px-3 py-2 text-sm text-muted-foreground">{children}</span>
  ) : (
    <a
      className="rounded-lg border px-3 py-2 text-sm font-bold focus-visible:ring-2 focus-visible:ring-ring"
      href={`/${locale}/admin/students?${params}`}
    >
      {children}
    </a>
  );
}

type Translation = Awaited<ReturnType<typeof getTranslations<"studentManagement">>>;
function getNotice(query: Record<string, string | string[] | undefined>, t: Translation) {
  const familyStatus = typeof query.familyStatus === "string" ? query.familyStatus : "";
  const familyError = typeof query.familyError === "string" ? query.familyError : "";
  const familyStatuses = ["linked", "unlinked", "parent_created", "student_created"] as const;
  if (familyStatuses.includes(familyStatus as (typeof familyStatuses)[number]))
    return {
      message: t(`family.notices.${familyStatus}` as "family.notices.linked"),
      success: true,
    };
  if (familyError)
    return {
      message: t(
        familyError === "invalid_fields"
          ? "family.errors.invalidFields"
          : familyError === "account_exists"
            ? "family.errors.accountExists"
            : "family.errors.requestFailed",
      ),
      success: false,
    };
  const status = typeof query.studentStatus === "string" ? query.studentStatus : "";
  const error = typeof query.studentError === "string" ? query.studentError : "";
  if (["created", "updated", "archived"].includes(status))
    return { message: t(`notices.${status}` as "notices.created"), success: true };
  if (error)
    return {
      message: t(error === "invalid_fields" ? "errors.invalidFields" : "errors.requestFailed"),
      success: false,
    };
  return { message: undefined, success: false };
}
