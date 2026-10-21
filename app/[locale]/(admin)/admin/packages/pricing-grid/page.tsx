import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { PricingGrid } from "@/components/packages/pricing-grid";
import { routing } from "@/i18n/routing";

export default async function PricingGridPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/packages/pricing-grid">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <PricingGrid locale={locale} searchParams={searchParams} />;
}
