import { Check, Clock3, Globe2, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { setCountryOverrideAction } from "@/lib/public-site/actions";
import { detectVisitorCountry } from "@/lib/public-site/country";
import { getPublicCountries, getPublicPackages } from "@/lib/public-site/packages";

type PackageCatalogueProps = { locale: AppLocale; returnPath: string };

function localized(valueAr: string | null, valueEn: string | null, locale: AppLocale) {
  return locale === "en" && valueEn ? valueEn : (valueAr ?? "");
}

export async function PackageCatalogue({ locale, returnPath }: PackageCatalogueProps) {
  const detectedCountry = await detectVisitorCountry();
  const [countries, packages, t] = await Promise.all([
    getPublicCountries(),
    getPublicPackages(detectedCountry),
    getTranslations({ locale, namespace: "publicSite.packages" }),
  ]);
  const selectedCountry = countries.some(({ code }) => code === detectedCountry)
    ? detectedCountry
    : "ZZ";
  const country = countries.find(({ code }) => code === selectedCountry);
  const numberLocale = locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const packageCount = new Intl.NumberFormat(numberLocale).format(packages.length);
  return (
    <>
      <section className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8">
          <div className="max-w-3xl">
            <p className="font-quran text-xl text-secondary">{t("eyebrow")}</p>
            <h1 className="mt-5 text-4xl leading-tight font-black text-balance sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-5 text-lg leading-9 text-primary-foreground/75">{t("description")}</p>
          </div>
          <form
            action={setCountryOverrideAction.bind(null, locale, returnPath)}
            className="grid min-w-0 gap-2 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/8 p-4 sm:grid-cols-[minmax(12rem,1fr)_auto] sm:items-end"
          >
            <label className="grid gap-2 text-sm font-bold" htmlFor="package-country">
              {t("countryLabel")}
              <select
                id="package-country"
                name="country"
                defaultValue={selectedCountry}
                autoComplete="country"
                className="min-h-11 rounded-lg border border-primary-foreground/25 bg-primary px-3 text-primary-foreground focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
              >
                {countries.map((option) => (
                  <option key={option.code} value={option.code}>
                    {localized(option.nameAr, option.nameEn, locale)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="gold">
              {t("updateCountry")}
            </Button>
          </form>
        </div>
      </section>

      <section
        className="mx-auto max-w-7xl px-6 py-16 lg:px-8"
        aria-labelledby="package-list-title"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="package-list-title" className="text-2xl font-black text-primary">
              {t("availableTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("countrySummary", {
                country: country
                  ? localized(country.nameAr, country.nameEn, locale)
                  : t("fallbackCountry"),
              })}
            </p>
          </div>
          <p className="rounded-full border bg-card px-4 py-2 text-sm font-bold text-primary">
            {t("packageCount", { count: packageCount })}
          </p>
        </div>

        {packages.length === 0 ? (
          <div className="mt-9 rounded-3xl border border-dashed bg-card p-9 text-center shadow-card">
            <Globe2 className="mx-auto size-10 text-secondary" aria-hidden="true" />
            <h2 className="mt-5 text-xl font-black text-primary">{t("empty.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl leading-8 text-muted-foreground">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="mt-9 grid gap-6 lg:grid-cols-2">
            {packages.map((item) => {
              const price = new Intl.NumberFormat(numberLocale, {
                style: "currency",
                currency: item.currency,
                maximumFractionDigits: 2,
              }).format(item.amount);
              const sessions = new Intl.NumberFormat(numberLocale).format(item.sessionsPerWeek);
              const minutes = new Intl.NumberFormat(numberLocale).format(item.durationMin);
              const fallback = item.countryCode !== selectedCountry;

              return (
                <article
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-3xl border bg-card shadow-card"
                >
                  <div className="border-b bg-muted/45 p-7 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-secondary">
                          {localized(item.trackNameAr, item.trackNameEn, locale) ||
                            t("generalTrack")}
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-balance text-primary">
                          {localized(item.nameAr, item.nameEn, locale)}
                        </h2>
                      </div>
                      <div className="text-end">
                        <p className="text-2xl font-black text-primary" dir="ltr">
                          {price}
                        </p>
                        <p className="mt-1 text-xs font-bold text-muted-foreground">
                          {t(`billing.${item.billingPeriod}`)}
                        </p>
                      </div>
                    </div>
                    {fallback ? (
                      <p className="mt-3 text-xs font-bold text-warning">{t("fallbackPrice")}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col p-7 sm:p-8">
                    <p className="leading-8 text-muted-foreground">
                      {localized(item.descriptionAr, item.descriptionEn, locale) ||
                        t("defaultDescription")}
                    </p>
                    <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-muted/55 p-3">
                        <dt className="flex items-center gap-2 font-bold text-muted-foreground">
                          <UsersRound className="size-4" aria-hidden="true" />
                          {t("sessions")}
                        </dt>
                        <dd className="mt-2 font-black text-primary">
                          {t("sessionsValue", { count: sessions })}
                        </dd>
                      </div>
                      <div className="rounded-xl bg-muted/55 p-3">
                        <dt className="flex items-center gap-2 font-bold text-muted-foreground">
                          <Clock3 className="size-4" aria-hidden="true" />
                          {t("duration")}
                        </dt>
                        <dd className="mt-2 font-black text-primary">
                          {t("durationValue", { minutes })}
                        </dd>
                      </div>
                    </dl>
                    {item.features.length > 0 ? (
                      <ul className="mt-6 grid gap-3">
                        {item.features.map((feature, index) => (
                          <li
                            key={`${item.id}-${index}`}
                            className="flex gap-3 text-sm leading-7 text-foreground"
                          >
                            <Check
                              className="mt-1 size-4 shrink-0 text-success"
                              aria-hidden="true"
                            />
                            <span>{locale === "en" && feature.en ? feature.en : feature.ar}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Button asChild className="mt-8 w-full" size="lg">
                      <Link href="/contact">{t("askAboutPackage")}</Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
