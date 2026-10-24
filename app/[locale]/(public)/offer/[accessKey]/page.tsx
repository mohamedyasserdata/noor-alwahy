import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PackageCatalogue } from "@/components/public-site/package-catalogue";
import { routing } from "@/i18n/routing";
import { hasPrivatePricingAccess } from "@/lib/public-site/pricing-access";

export const metadata: Metadata = {
  robots: { follow: false, index: false, noarchive: true, nosnippet: true },
  referrer: "no-referrer",
};
export const instant = false;

export default async function PrivateOfferPage({
  params,
}: PageProps<"/[locale]/offer/[accessKey]">) {
  const { accessKey, locale } = await params;
  if (!hasLocale(routing.locales, locale) || !hasPrivatePricingAccess(accessKey)) notFound();
  const t = await getTranslations({ locale, namespace: "publicSite.packages" });
  const returnPath = `/${locale}/offer/${encodeURIComponent(accessKey)}`;

  return (
    <div className="min-h-[52rem]">
      <Suspense
        fallback={
          <div className="mx-auto min-h-[52rem] max-w-7xl px-6 py-20 lg:px-8" role="status">
            <p className="font-bold text-muted-foreground">{t("loading")}</p>
          </div>
        }
      >
        <PackageCatalogue locale={locale} returnPath={returnPath} />
      </Suspense>
    </div>
  );
}
