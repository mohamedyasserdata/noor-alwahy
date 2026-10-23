import { DateTime } from "luxon";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PackageWizard } from "@/components/packages/package-wizard";
import { routing } from "@/i18n/routing";
import { getPackageAdminData } from "@/lib/packages/queries";
import { packageIdSchema, packageWizardSchema } from "@/lib/validators/packages";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ package?: string | string[] }>;
};

export default async function PackageWizardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <Suspense
      fallback={
        <div
          className="min-h-96 animate-pulse rounded-3xl border bg-card shadow-soft motion-reduce:animate-none"
          role="status"
          aria-label={locale === "ar" ? "جارٍ تجهيز معالج الباقات" : "Preparing package wizard"}
        />
      }
    >
      <PackageWizardContent locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function PackageWizardContent({
  locale,
  searchParams,
}: {
  locale: "ar" | "en";
  searchParams: Props["searchParams"];
}) {
  const [query, data] = await Promise.all([searchParams, getPackageAdminData()]);

  const validFrom = DateTime.utc().toISO();
  if (!validFrom) throw new Error("package_management_unavailable");
  const requestedId = typeof query.package === "string" ? query.package : "";
  if (requestedId && !packageIdSchema.safeParse(requestedId).success) notFound();
  const selected = requestedId ? data.packages.find((item) => item.id === requestedId) : undefined;
  if (requestedId && !selected) notFound();

  const initialValue = selected
    ? packageWizardSchema.parse({
        package_id: selected.id,
        slug: selected.slug,
        track_id: selected.track_id ?? "",
        name_ar: selected.name_ar,
        name_en: selected.name_en ?? "",
        description_ar: selected.description_ar ?? "",
        description_en: selected.description_en ?? "",
        audience: selected.audience,
        teacher_gender: selected.teacher_gender ?? "",
        sessions_per_week: selected.sessions_per_week,
        duration_min: selected.duration_min,
        billing_period: selected.billing_period,
        features: selected.features,
        policy: selected.policy,
        prices: data.prices
          .filter((price) => price.package_id === selected.id)
          .map((price) => ({
            country_code: price.country_code,
            currency: price.currency,
            amount: String(price.amount),
            min_amount: price.min_amount === null ? "" : String(price.min_amount),
            max_amount: price.max_amount === null ? "" : String(price.max_amount),
            is_active: price.is_active,
            valid_from: validFrom,
          })),
        is_published: selected.is_published,
      })
    : undefined;

  return (
    <PackageWizard
      validFrom={validFrom}
      initialValue={initialValue}
      tracks={data.tracks.map((track) => ({
        id: track.id,
        name: locale === "ar" ? track.name_ar : (track.name_en ?? track.name_ar),
      }))}
      countries={data.countries.map((country) => ({
        code: country.code,
        name: locale === "ar" ? country.name_ar : (country.name_en ?? country.name_ar),
        currency: country.currency,
      }))}
    />
  );
}
