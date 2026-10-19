import { getTranslations } from "next-intl/server";

import { NextSessionCard } from "@/components/sessions/next-session-card";
import type { AppLocale } from "@/i18n/routing";
import { getNextSessionCard } from "@/lib/sessions/next-session";

export async function NextSessionSection({ locale }: { locale: AppLocale }) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "nextSession" }),
    getNextSessionCard(locale),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="next-session-title">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 id="next-session-title" className="text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      <NextSessionCard serverNowMs={data.serverNowMs} session={data.session} />
    </section>
  );
}
