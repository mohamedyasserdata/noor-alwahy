import type { Metadata } from "next";
import {
  ArrowUpLeft,
  BookOpen,
  CalendarCheck2,
  ChartNoAxesCombined,
  UserRoundCheck,
} from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { HomePackages } from "@/components/public-site/home-packages";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localizedMetadata } from "@/lib/seo/metadata";

const journeyIcons = [UserRoundCheck, CalendarCheck2, BookOpen, ChartNoAxesCombined] as const;
const trackKeys = ["memorization", "recitation", "foundation"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.home.meta" });
  return localizedMetadata({ locale, path: "/", title: t("title"), description: t("description") });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.home" });

  return (
    <>
      <section className="relative isolate border-b">
        <div className="islamic-pattern absolute inset-0 -z-20 opacity-35" aria-hidden="true" />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-background/45 via-background/90 to-background"
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,.9fr)] lg:items-center lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <p className="inline-flex min-h-9 items-center rounded-full border border-secondary/35 bg-secondary/10 px-4 text-sm font-extrabold text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="mt-7 max-w-3xl text-4xl leading-[1.25] font-black text-balance text-primary sm:text-6xl sm:leading-[1.18]">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-pretty text-muted-foreground">
              {t("description")}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="gold">
                <Link href="/apply">
                  {t("primaryAction")}
                  <ArrowUpLeft className="rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/tracks">{t("secondaryAction")}</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg" aria-label={t("journey.label")}>
            <div
              className="absolute start-[1.7rem] top-10 bottom-10 w-px bg-gradient-to-b from-secondary via-secondary/55 to-primary/20 sm:start-8"
              aria-hidden="true"
            />
            <ol className="grid gap-4">
              {journeyIcons.map((Icon, index) => (
                <li
                  key={index}
                  className="relative grid grid-cols-[3.5rem_1fr] items-center gap-4 sm:grid-cols-[4rem_1fr]"
                >
                  <span className="relative z-10 grid size-14 place-items-center rounded-full border-4 border-background bg-primary text-secondary shadow-card sm:size-16">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <div className="rounded-2xl border bg-card/95 p-5 shadow-card">
                    <h2 className="font-black text-primary">{t(`journey.steps.${index}.title`)}</h2>
                    <p className="mt-1 text-sm leading-7 text-muted-foreground">
                      {t(`journey.steps.${index}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8"
        aria-labelledby="tracks-title"
      >
        <div className="max-w-3xl">
          <h2
            id="tracks-title"
            className="text-3xl font-black text-balance text-primary sm:text-4xl"
          >
            {t("tracks.title")}
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{t("tracks.description")}</p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border bg-border lg:grid-cols-3">
          {trackKeys.map((key, index) => (
            <article key={key} className="bg-card p-7 sm:p-8">
              <span className="font-quran text-4xl text-secondary" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="mt-5 text-xl font-black text-primary">
                {t(`tracks.items.${key}.title`)}
              </h3>
              <p className="mt-3 leading-8 text-muted-foreground">
                {t(`tracks.items.${key}.description`)}
              </p>
            </article>
          ))}
        </div>
        <Button asChild variant="ghost" className="mt-7">
          <Link href="/tracks">{t("tracks.action")}</Link>
        </Button>
      </section>

      <HomePackages locale={locale} />

      <section className="border-y bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black text-balance">{t("closing.title")}</h2>
            <p className="mt-4 leading-8 text-primary-foreground/75">{t("closing.description")}</p>
          </div>
          <Button asChild size="lg" variant="gold">
            <Link href="/contact">{t("closing.action")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
