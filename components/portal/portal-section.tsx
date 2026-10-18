import { LockKeyhole, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { isPortalSection, type PortalId } from "@/components/portal/portal-config";
import type { AppLocale } from "@/i18n/routing";

type PortalSectionProps = {
  locale: AppLocale;
  portal: PortalId;
  section: string;
};

export async function PortalSection({ locale, portal, section }: PortalSectionProps) {
  if (!isPortalSection(portal, section)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "portals" });

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="portal-page-title">
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {t(`${portal}.roleName`)}
        </p>
        <h1
          id="portal-page-title"
          className="text-3xl font-black tracking-tight text-balance text-primary sm:text-4xl lg:text-5xl"
        >
          {t(`${portal}.sections.${section}.title`)}
        </h1>
        <p className="mt-4 text-base leading-8 text-pretty text-muted-foreground sm:text-lg">
          {t(`${portal}.sections.${section}.description`)}
        </p>
      </header>

      <div className="mt-9 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="relative min-h-72 overflow-hidden rounded-3xl border bg-card p-6 shadow-card sm:p-8">
          <div
            className="pointer-events-none absolute end-8 top-6 h-52 w-36 rounded-t-[7rem] border border-secondary/20 bg-secondary/5"
            aria-hidden="true"
          />
          <div className="relative max-w-xl">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-secondary shadow-card">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-8 text-2xl font-black text-primary">{t("emptyState.title")}</h2>
            <p className="mt-3 leading-8 text-muted-foreground">{t("emptyState.description")}</p>
          </div>
        </article>

        <aside className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-card sm:p-7">
          <ShieldCheck className="size-7 text-secondary" aria-hidden="true" />
          <h2 className="mt-5 text-xl font-black">{t("privacy.title")}</h2>
          <p className="mt-3 text-sm leading-7 text-primary-foreground/78">
            {t("privacy.description")}
          </p>
          <div className="mt-7 flex items-start gap-3 border-t border-primary-foreground/15 pt-5">
            <MonitorSmartphone
              className="mt-0.5 size-5 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <p className="text-sm leading-6 text-primary-foreground/78">{t("responsiveNote")}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
