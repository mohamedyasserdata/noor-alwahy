import { Award, CalendarDays, ChartNoAxesCombined, Headphones } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { NextSessionCard } from "@/components/sessions/next-session-card";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getNextSessionCard } from "@/lib/sessions/next-session";

export async function NextSessionSection({ locale }: { locale: AppLocale }) {
  const [t, portalT, data] = await Promise.all([
    getTranslations({ locale, namespace: "nextSession" }),
    getTranslations({ locale, namespace: "portals.student" }),
    getNextSessionCard(locale),
  ]);
  const quickLinks = [
    { section: "progress", icon: ChartNoAxesCombined },
    { section: "schedule", icon: CalendarDays },
    { section: "certificates", icon: Award },
    { section: "contact", icon: Headphones },
  ] as const;

  return (
    <section className="mx-auto w-full" aria-labelledby="next-session-title">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-secondary/25 bg-card shadow-soft">
        <div className="grid min-h-[21rem] lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
          <header className="islamic-pattern relative z-10 flex flex-col justify-center bg-card/96 px-6 py-10 sm:px-10 lg:px-12">
            <span className="mb-5 h-1 w-16 rounded-full bg-secondary" aria-hidden="true" />
            <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
            <h1
              id="next-session-title"
              className="mt-3 max-w-xl text-4xl leading-tight font-black text-balance text-primary sm:text-5xl"
            >
              {t("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-pretty text-muted-foreground sm:text-lg">
              {t("description")}
            </p>
          </header>
          <div className="relative min-h-60 overflow-hidden lg:min-h-full">
            <Image
              src="/images/student-portal/hero-quran.png"
              alt=""
              fill
              preload
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover object-center"
            />
            <div
              className="absolute inset-0 bg-linear-to-t from-primary/20 via-transparent to-transparent dark:from-background/55"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-3 -mt-7 sm:mx-7 lg:mx-10">
        <NextSessionCard serverNowMs={data.serverNowMs} session={data.session} />
      </div>

      <section className="mt-8" aria-labelledby="student-quick-links-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2
              id="student-quick-links-title"
              className="text-xl font-black text-primary sm:text-2xl"
            >
              {t("quickLinksTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("quickLinksDescription")}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map(({ section, icon: Icon }) => (
            <Link
              key={section}
              href={`/student/${section}`}
              className="group flex min-h-32 touch-manipulation items-start gap-4 rounded-2xl border border-secondary/20 bg-card/92 p-5 shadow-card backdrop-blur transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-secondary/50 hover:bg-card hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transform-none motion-reduce:transition-none"
              aria-label={t("openSection", { section: portalT(`sections.${section}.label`) })}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary/14 text-secondary ring-1 ring-secondary/20">
                <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-black text-primary">
                  {portalT(`sections.${section}.label`)}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm leading-6 text-muted-foreground">
                  {portalT(`sections.${section}.description`)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
