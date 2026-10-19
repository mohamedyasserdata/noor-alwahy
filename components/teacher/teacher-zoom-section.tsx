import { Link2, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { saveTeacherZoomAction } from "@/lib/teacher-zoom/actions";
import { getOwnZoomSetting } from "@/lib/teacher-zoom/management";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function TeacherZoomSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, teacher, query] = await Promise.all([
    getTranslations({ locale, namespace: "teacherZoom" }),
    getOwnZoomSetting(),
    searchParams,
  ]);
  const setting = one(teacher?.teacher_zoom_settings ?? null);
  const status = typeof query.zoomStatus === "string" ? query.zoomStatus : "";
  const error = typeof query.zoomError === "string" ? query.zoomError : "";
  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="zoom-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 id="zoom-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      {status ? (
        <Alert className="mt-6" variant="success">
          {t("saved")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(`errors.${error}` as "errors.invalid_url")}
        </Alert>
      ) : null}
      {!teacher ? (
        <Alert className="mt-8" variant="warning">
          {t("errors.profile_missing")}
        </Alert>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form
            action={saveTeacherZoomAction.bind(null, locale)}
            className="rounded-3xl border bg-card p-6 shadow-card"
          >
            <h2 className="flex items-center gap-2 text-xl font-black text-primary">
              <Link2 className="size-5 text-secondary" aria-hidden="true" />
              {t("formTitle")}
            </h2>
            <div className="mt-5 grid gap-2">
              <Label htmlFor="teacher-zoom-url">{t("urlLabel")}</Label>
              <Input
                id="teacher-zoom-url"
                name="joinUrl"
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                defaultValue={setting?.join_url ?? ""}
                placeholder="https://zoom.us/j/…"
                required
              />
              <p className="text-sm leading-6 text-muted-foreground">{t("allowedHosts")}</p>
            </div>
            <div className="mt-5">
              <AdminSubmitButton label={t("save")} pendingLabel={t("saving")} />
            </div>
          </form>
          <aside className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-card">
            <ShieldCheck className="size-7 text-secondary" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">{t("privacyTitle")}</h2>
            <p className="mt-3 text-sm leading-7 text-primary-foreground/80">
              {t("privacyDescription")}
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
