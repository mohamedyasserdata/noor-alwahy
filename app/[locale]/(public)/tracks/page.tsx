import type { Metadata } from "next";
import { BookHeart, BookOpenCheck, Sparkles } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localizedMetadata } from "@/lib/seo/metadata";

const tracks = [
  { key: "memorization", Icon: BookHeart },
  { key: "recitation", Icon: BookOpenCheck },
  { key: "foundation", Icon: Sparkles },
] as const;

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
  const t = await getTranslations({ locale, namespace: "publicSite.tracks" });

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
        <div className="grid gap-6 lg:grid-cols-3">
          {tracks.map(({ key, Icon }) => (
            <article
              key={key}
              className="flex flex-col border-t-4 border-secondary bg-card p-7 shadow-card sm:p-8"
            >
              <span className="grid size-14 place-items-center rounded-full bg-primary text-secondary">
                <Icon className="size-7" aria-hidden="true" />
              </span>
              <h2 className="mt-6 text-2xl font-black text-primary">{t(`items.${key}.title`)}</h2>
              <p className="mt-3 leading-8 text-muted-foreground">
                {t(`items.${key}.description`)}
              </p>
              <div className="mt-7 border-t pt-5">
                <h3 className="text-sm font-black text-primary">{t("focusLabel")}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {t(`items.${key}.focus`)}
                </p>
              </div>
            </article>
          ))}
        </div>
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
