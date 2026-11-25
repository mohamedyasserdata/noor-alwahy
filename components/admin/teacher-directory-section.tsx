import { Clock3, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import { reviewAvailabilityAction } from "@/lib/teachers/actions";
import { getTeacherManagement } from "@/lib/teachers/management";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function TeacherDirectorySection({
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

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="teacher-management-title">
      <header className="max-w-3xl">
        <h1 id="teacher-management-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 leading-8 text-muted-foreground">
          {locale === "ar"
            ? "افتح ملف المعلم لمتابعة طلابه وجدوله وسعته. إنشاء حساب معلم جديد يتم من صفحة الحسابات."
            : "Open a teacher profile to review students, schedule, and capacity. Create new teacher accounts from Accounts."}
        </p>
      </header>

      {status ? (
        <Alert className="mt-6" variant="success">
          {t(`notices.${status}` as "notices.created")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t("errors.requestFailed")}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="teacher-directory-title">
          <h2
            id="teacher-directory-title"
            className="flex items-center gap-2 text-2xl font-black text-primary"
          >
            <Users className="size-6 text-secondary" aria-hidden="true" />
            {t("directory")}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {data.teachers.length ? (
              data.teachers.map((teacher) => {
                const profile = one(teacher.profile);
                return (
                  <article key={teacher.id} className="rounded-2xl border bg-card p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-xl font-black text-primary">
                          {locale === "ar" ? "م. " : "T. "}
                          {profile?.full_name ?? t("unknown")}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {locale === "ar"
                            ? `السعة القصوى: ${teacher.max_students} طالبًا`
                            : `Capacity: ${teacher.max_students} students`}
                        </p>
                      </div>
                      <Badge variant={teacher.status === "active" ? "success" : "outline"}>
                        {t(`statuses.${teacher.status}` as "statuses.active")}
                      </Badge>
                    </div>
                    <Button asChild className="mt-5 w-full" size="sm">
                      <a href={`/${locale}/admin/teachers/${teacher.id}`}>
                        {locale === "ar" ? "فتح ملف المعلم" : "Open teacher profile"}
                      </a>
                    </Button>
                  </article>
                );
              })
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-muted-foreground md:col-span-2">
                {t("empty")}
              </p>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-xl font-black text-primary">
            <Clock3 className="size-5 text-secondary" aria-hidden="true" />
            {t("availability.title")}
          </h2>
          <div className="mt-4 grid gap-3">
            {data.availability.length ? (
              data.availability.map((slot) => {
                const teacher = one(slot.teacher);
                const profile = teacher ? one(teacher.profile) : null;
                return (
                  <div key={slot.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-black text-primary">
                      {locale === "ar" ? "م. " : "T. "}
                      {profile?.full_name ?? t("unknown")}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t(`weekdays.${slot.weekday}` as "weekdays.0")} ·{" "}
                      {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
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
              })
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {locale === "ar"
                  ? "لم تُسجل أوقات متاحة بعد."
                  : "No availability has been recorded yet."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
