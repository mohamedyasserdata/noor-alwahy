import { ArrowRight, Check, PackagePlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PackageOrderBoard } from "@/components/packages/package-order-board";
import { PackageImportPanel } from "@/components/packages/package-import-panel";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getPackageAdminData } from "@/lib/packages/queries";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function PackageAdminSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [query, t, data] = await Promise.all([
    searchParams,
    getTranslations({ locale, namespace: "packageAdmin" }),
    getPackageAdminData(),
  ]);
  const status = typeof query.packageStatus === "string" ? query.packageStatus : "";
  const error = typeof query.packageError === "string" ? query.packageError : "";
  const previewId = typeof query.preview === "string" ? query.preview : "";
  const preview = data.packages.find((item) => item.id === previewId);
  const items = data.packages.map((item) => {
    const fallback = data.prices.find(
      (price) => price.package_id === item.id && price.country_code === "ZZ" && price.is_active,
    );
    return {
      id: item.id,
      slug: item.slug,
      name: locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar),
      sessionsPerWeek: item.sessions_per_week,
      durationMin: item.duration_min,
      isPublished: item.is_published,
      isActive: item.is_active,
      fallbackPrice: fallback ? { amount: fallback.amount, currency: fallback.currency } : null,
    };
  });

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="packages-title">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1 id="packages-title" className="text-3xl font-black text-primary sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild variant="gold">
          <Link href="/admin/packages/wizard">
            <PackagePlus aria-hidden="true" />
            {t("actions.newPackage")}
          </Link>
        </Button>
      </header>

      {status ? (
        <Alert className="mt-6" variant="success">
          {t(`notices.${status}` as "notices.saved")}
        </Alert>
      ) : null}
      {error ? (
        <Alert className="mt-6" variant="warning">
          {t(`errors.${error}` as "errors.save_failed")}
        </Alert>
      ) : null}

      <PackageImportPanel />

      {preview ? (
        <article className="mt-8 overflow-hidden rounded-3xl border border-secondary/35 bg-card shadow-soft">
          <div className="bg-primary p-7 text-primary-foreground">
            <p className="text-sm font-bold text-secondary">{t("visitorPreview")}</p>
            <h2 className="mt-3 text-3xl font-black">
              {locale === "ar" ? preview.name_ar : (preview.name_en ?? preview.name_ar)}
            </h2>
            <p className="mt-3 max-w-3xl leading-8 text-primary-foreground/75">
              {locale === "ar"
                ? preview.description_ar
                : (preview.description_en ?? preview.description_ar)}
            </p>
          </div>
          <div className="grid gap-5 p-7 sm:grid-cols-[1fr_auto] sm:items-center">
            <ul className="grid gap-2 text-sm text-muted-foreground">
              {(Array.isArray(preview.features) ? preview.features : []).map((feature, index) => {
                const item = feature as { ar?: string; en?: string };
                return (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="size-4 text-success" aria-hidden="true" />
                    {locale === "ar" ? item.ar : item.en || item.ar}
                  </li>
                );
              })}
            </ul>
            <Button asChild variant="outline">
              <Link href="/admin/packages">
                <ArrowRight aria-hidden="true" />
                {t("actions.closePreview")}
              </Link>
            </Button>
          </div>
        </article>
      ) : null}

      <div className="mt-8">
        <PackageOrderBoard packages={items} />
      </div>
    </section>
  );
}
