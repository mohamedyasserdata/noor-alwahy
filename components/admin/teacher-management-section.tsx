import { BadgeCheck, Clock3, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { reviewAvailabilityAction, saveTeacherAction } from "@/lib/teachers/actions";
import { getTeacherManagement } from "@/lib/teachers/management";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function TeacherManagementSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "teacherManagement" }),
    getTeacherManagement(),
    searchParams,
  ]);
  const status = typeof query.teacherStatus === "string" ? query.teacherStatus : "";
  const error = typeof query.teacherError === "string" ? query.teacherError : "";
  const linkedProfiles = new Set(data.teachers.map((teacher) => teacher.profile_id));
  const availableProfiles = data.profiles.filter((profile) => !linkedProfiles.has(profile.id));
  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="teacher-management-title">
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {t("eyebrow")}
        </p>
        <h1 id="teacher-management-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      {status ? (
        <Alert className="mt-6" variant="success">
          {t(`notices.${status}` as "notices.created")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(
            error === "activation_requirements"
              ? "errors.activationRequirements"
              : error === "invalid_fields"
                ? "errors.invalidFields"
                : "errors.requestFailed",
          )}
        </Alert>
      ) : null}
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid gap-5">
          <h2 className="flex items-center gap-2 text-2xl font-black text-primary">
            <Users className="size-6 text-secondary" aria-hidden="true" />
            {t("directory")}
          </h2>
          {data.teachers.length ? (
            data.teachers.map((teacher) => {
              const profile = one(teacher.profile);
              const ijazah = Array.isArray(teacher.ijazah_info)
                ? (teacher.ijazah_info[0] as { riwaya?: string; sanad?: string } | undefined)
                : undefined;
              const trackIds = new Set(teacher.teacher_tracks.map((link) => link.track_id));
              return (
                <article key={teacher.id} className="rounded-3xl border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-primary">
                        {profile?.full_name ?? t("unknown")}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{profile?.timezone}</p>
                    </div>
                    <Badge variant={teacher.status === "active" ? "success" : "outline"}>
                      {t(`statuses.${teacher.status}` as "statuses.active")}
                    </Badge>
                  </div>
                  <TeacherForm
                    locale={locale}
                    t={t}
                    profiles={data.profiles.filter((item) => item.id === teacher.profile_id)}
                    tracks={data.tracks}
                    value={{ ...teacher, ijazah, trackIds }}
                  />
                </article>
              );
            })
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </div>
        <aside className="grid content-start gap-6">
          <article className="rounded-3xl border bg-card p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-xl font-black text-primary">
              <GraduationCap className="size-5 text-secondary" aria-hidden="true" />
              {t("addTitle")}
            </h2>
            {availableProfiles.length ? (
              <TeacherForm
                locale={locale}
                t={t}
                profiles={availableProfiles}
                tracks={data.tracks}
              />
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("noProfiles")}</p>
            )}
          </article>
          <article className="rounded-3xl border bg-card p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-xl font-black text-primary">
              <Clock3 className="size-5 text-secondary" aria-hidden="true" />
              {t("availability.title")}
            </h2>
            <div className="mt-4 grid gap-3">
              {data.availability.map((slot) => {
                const teacher = one(slot.teacher);
                const profile = teacher ? one(teacher.profile) : null;
                return (
                  <div key={slot.id} className="rounded-2xl border p-3 text-sm">
                    <p className="font-black text-primary">{profile?.full_name ?? t("unknown")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {t(`weekdays.${slot.weekday}` as "weekdays.0")} ·{" "}
                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} ·{" "}
                      {profile?.timezone}
                    </p>
                    <Badge
                      className="mt-2"
                      variant={slot.status === "approved" ? "success" : "outline"}
                    >
                      {t(
                        `availability.statuses.${slot.status}` as "availability.statuses.proposed",
                      )}
                    </Badge>
                    {slot.status === "proposed" ? (
                      <div className="mt-3 flex gap-2">
                        {(["approved", "rejected"] as const).map((review) => (
                          <form action={reviewAvailabilityAction.bind(null, locale)} key={review}>
                            <input type="hidden" name="availabilityId" value={slot.id} />
                            <input type="hidden" name="status" value={review} />
                            <AdminSubmitButton
                              label={t(`availability.${review}`)}
                              pendingLabel={t("saving")}
                              variant={review === "rejected" ? "destructive" : "gold"}
                            />
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations<"teacherManagement">>>;
type FormValue = {
  id: string;
  profile_id: string;
  gender: "male" | "female";
  specialization: string | null;
  max_students: number;
  status: string;
  identity_verified_at: string | null;
  ijazah?: { riwaya?: string; sanad?: string };
  trackIds: Set<string>;
};
function TeacherForm({
  locale,
  t,
  profiles,
  tracks,
  value,
}: {
  locale: AppLocale;
  t: Translator;
  profiles: Array<{ id: string; full_name: string }>;
  tracks: Array<{ id: string; code: string; name_ar: string; name_en: string | null }>;
  value?: FormValue;
}) {
  const suffix = value?.id ?? "new";
  return (
    <form action={saveTeacherAction.bind(null, locale)} className="mt-5 grid gap-4">
      <input type="hidden" name="teacherId" value={value?.id ?? ""} />
      <Field label={t("fields.profile")} id={`profile-${suffix}`}>
        <select
          id={`profile-${suffix}`}
          name="profileId"
          defaultValue={value?.profile_id}
          className="min-h-11 rounded-xl border bg-background px-3"
          required
        >
          {profiles.map((profile) => (
            <option value={profile.id} key={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.gender")} id={`gender-${suffix}`}>
          <select
            id={`gender-${suffix}`}
            name="gender"
            defaultValue={value?.gender ?? "male"}
            className="min-h-11 rounded-xl border bg-background px-3"
          >
            <option value="male">{t("genders.male")}</option>
            <option value="female">{t("genders.female")}</option>
          </select>
        </Field>
        <Field label={t("fields.maxStudents")} id={`capacity-${suffix}`}>
          <Input
            id={`capacity-${suffix}`}
            name="maxStudents"
            type="number"
            min="1"
            max="200"
            defaultValue={value?.max_students ?? 15}
            required
          />
        </Field>
      </div>
      <Field label={t("fields.specialization")} id={`specialization-${suffix}`}>
        <Input
          id={`specialization-${suffix}`}
          name="specialization"
          defaultValue={value?.specialization ?? ""}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.riwaya")} id={`riwaya-${suffix}`}>
          <Input
            id={`riwaya-${suffix}`}
            name="ijazahRiwaya"
            defaultValue={value?.ijazah?.riwaya ?? ""}
          />
        </Field>
        <Field label={t("fields.sanad")} id={`sanad-${suffix}`}>
          <Input
            id={`sanad-${suffix}`}
            name="ijazahSanad"
            defaultValue={value?.ijazah?.sanad ?? ""}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-bold">{t("fields.tracks")}</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {tracks.map((track) => (
            <label
              key={track.id}
              className="flex min-h-11 items-center gap-2 rounded-xl border px-3"
            >
              <input
                type="checkbox"
                name="trackIds"
                value={track.id}
                defaultChecked={value?.trackIds.has(track.id)}
              />
              {locale === "ar" ? track.name_ar : (track.name_en ?? track.name_ar)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.status")} id={`status-${suffix}`}>
          <select
            id={`status-${suffix}`}
            name="status"
            defaultValue={value?.status ?? "pending"}
            className="min-h-11 rounded-xl border bg-background px-3"
          >
            {["pending", "active", "on_leave", "inactive"].map((item) => (
              <option key={item} value={item}>
                {t(`statuses.${item}` as "statuses.pending")}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border px-3 text-sm font-bold">
          <input
            type="checkbox"
            name="identityVerified"
            defaultChecked={Boolean(value?.identity_verified_at)}
          />
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t("fields.identityVerified")}
        </label>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BadgeCheck className="size-4" aria-hidden="true" />
        {t("conductManagedByTeacher")}
      </div>
      <AdminSubmitButton label={value ? t("save") : t("create")} pendingLabel={t("saving")} />
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
