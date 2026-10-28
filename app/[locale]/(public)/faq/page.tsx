import type { Metadata } from "next";
import { CircleHelp } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { publicHomeCopy } from "@/components/public-site/public-home-content";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.faq.meta" });
  return localizedMetadata({
    locale,
    path: "/faq",
    title: t("title"),
    description: t("description"),
  });
}

export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.faq" });
  const questions = publicHomeCopy[locale].faq.items;

  return (
    <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20 lg:px-8">
      <header className="max-w-3xl">
        <span className="grid size-14 place-items-center rounded-full bg-primary text-secondary">
          <CircleHelp className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-4xl font-black text-balance text-primary sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 text-lg leading-9 text-muted-foreground">{t("description")}</p>
      </header>

      <div className="mt-12 divide-y border-y">
        {questions.map(([question, answer], index) => (
          <details key={question} className="group py-2" open={index === 0}>
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 rounded-lg px-3 font-black text-primary hover:bg-accent/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <span>{question}</span>
              <span
                className="text-2xl leading-none text-secondary transition-transform group-open:rotate-45 motion-reduce:transition-none"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="max-w-3xl px-3 pb-6 leading-8 text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>

      <aside className="mt-12 flex flex-col gap-5 rounded-3xl bg-primary p-7 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div>
          <h2 className="text-xl font-black">{t("more.title")}</h2>
          <p className="mt-2 leading-7 text-primary-foreground/75">{t("more.description")}</p>
        </div>
        <Button asChild variant="gold">
          <Link href="/contact">{t("more.action")}</Link>
        </Button>
      </aside>
    </section>
  );
}
