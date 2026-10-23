import { getTranslations } from "next-intl/server";

import type { AppLocale } from "@/i18n/routing";
import { legalDocumentVersion } from "@/lib/legal/documents";

const privacySections = [
  "collection",
  "purpose",
  "sharing",
  "children",
  "retention",
  "rights",
  "security",
  "contact",
] as const;
const termsSections = [
  "service",
  "accounts",
  "lessons",
  "payments",
  "conduct",
  "content",
  "termination",
  "liability",
  "changes",
] as const;

export async function LegalPage({
  locale,
  kind,
}: {
  locale: AppLocale;
  kind: "privacy" | "terms";
}) {
  const t = await getTranslations({ locale, namespace: `legal.${kind}` });
  const sections = kind === "privacy" ? privacySections : termsSections;
  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="rounded-3xl border bg-card p-6 shadow-soft sm:p-9">
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black text-balance text-primary">{t("title")}</h1>
        <p className="mt-4 leading-8 text-pretty text-muted-foreground">{t("summary")}</p>
        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-7">
          <strong>{t("draftTitle")}</strong> {t("draftDescription")}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {t("version", { version: legalDocumentVersion })}
        </p>
      </header>
      <div className="mt-8 grid gap-5">
        {sections.map((section) => (
          <section key={section} className="scroll-mt-24 rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-black text-primary">{t(`sections.${section}.title`)}</h2>
            <p className="mt-3 leading-8 text-pretty whitespace-pre-line text-muted-foreground">
              {t(`sections.${section}.body`)}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
