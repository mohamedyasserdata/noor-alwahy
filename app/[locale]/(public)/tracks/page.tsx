import type { Metadata } from "next";
import { BookHeart } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPublicPackages } from "@/lib/public-site/packages";
import { localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tracks">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.tracks.meta" });
  return localizedMetadata({
    locale,
    path: "/tracks",
    title: t("title"),
    description: t("description"),
  });
}

export default async function TracksPage({ params }: PageProps<"/[locale]/tracks">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, packages] = await Promise.all([
    getTranslations({ locale, namespace: "publicSite.tracks" }),
    getPublicPackages("ZZ"),
  ]);
  const publishedTrack =
    packages.find((item) => item.trackNameAr?.includes("القرآن")) ?? packages[0];
  const trackName =
    (locale === "en" ? publishedTrack?.trackNameEn : publishedTrack?.trackNameAr) ??
    t("items.memorization.title");

  return (
    <>
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <p className="font-quran text-xl text-secondary">{t("eyebrow")}</p>
          <h1 className="mt-5 max-w-4xl text-4xl leading-tight font-black text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-9 text-primary-foreground/75">
            {t("description")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8" aria-label={t("listLabel")}>
        <article className="grid overflow-hidden rounded-3xl border border-secondary/25 bg-card shadow-card lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="grid place-items-center bg-primary px-10 py-10 text-secondary sm:px-14 lg:min-w-64">
            <BookHeart className="size-20" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="p-7 sm:p-10">
            <h2 className="text-3xl font-black text-primary">{trackName}</h2>
            <p className="mt-4 max-w-3xl text-lg leading-9 text-muted-foreground">
              {t("items.memorization.description")}
            </p>
            <div className="mt-7 border-t border-secondary/20 pt-5">
              <h3 className="text-sm font-black text-primary">{t("focusLabel")}</h3>
              <p className="mt-2 max-w-3xl leading-8 text-muted-foreground">
                {t("items.memorization.focus")}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="border-t bg-muted/55">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 sm:grid-cols-[1fr_auto] sm:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-black text-primary">{t("help.title")}</h2>
            <p className="mt-3 max-w-2xl leading-8 text-muted-foreground">
              {t("help.description")}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/contact">{t("help.action")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
