import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PackageCatalogue } from "@/components/public-site/package-catalogue";
import { routing } from "@/i18n/routing";
import { localizedMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/packages">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.packages.meta" });
  return localizedMetadata({
    locale,
    path: "/packages",
    title: t("title"),
    description: t("description"),
  });
}

export default async function PackagesPage({ params }: PageProps<"/[locale]/packages">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.packages" });

  return (
    <Suspense
      fallback={
        <div className="mx-auto min-h-[32rem] max-w-7xl px-6 py-20 lg:px-8" role="status">
          <p className="font-bold text-muted-foreground">{t("loading")}</p>
        </div>
      }
    >
      <PackageCatalogue locale={locale} />
    </Suspense>
  );
}
