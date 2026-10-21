import { CalendarClock, Copy, Grid3X3, Upload } from "lucide-react";
import { DateTime } from "luxon";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import {
  appendPriceAction,
  confirmBulkPricingAction,
  previewBulkPricingAction,
} from "@/lib/pricing-grid/actions";
import { getPricingGridData } from "@/lib/pricing-grid/queries";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function PricingGrid({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const query = await searchParams;
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "pricingGrid" }),
    getPricingGridData(query),
  ]);
  const status = typeof query.pricingStatus === "string" ? query.pricingStatus : "";
  const error = typeof query.pricingError === "string" ? query.pricingError : "";
  const dateValue = DateTime.fromISO(data.bulk?.validFrom ?? data.now)
    .toUTC()
    .toFormat("yyyy-MM-dd'T'HH:mm");
  const localized = (item: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? item.name_ar : (item.name_en ?? item.name_ar);
  return (
    <section className="mx-auto w-full max-w-[96rem]" aria-labelledby="pricing-grid-title">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1 id="pricing-grid-title" className="mt-3 text-3xl font-black text-primary sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/packages">
              <Upload aria-hidden="true" />
              {t("import")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/packages">{t("packages")}</Link>
          </Button>
        </div>
      </header>
      {status ? (
        <p className="mt-5 rounded-xl bg-success/10 p-4 font-bold text-success">
          {t(`notices.${status}` as "notices.saved", {
            count: typeof query.count === "string" ? query.count : "0",
          })}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {t(`errors.${error}` as "errors.save_failed")}
        </p>
      ) : null}

      <section
        className="mt-8 rounded-3xl border bg-card p-5 shadow-card sm:p-7"
        aria-labelledby="bulk-pricing-title"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-secondary/15 text-secondary">
            <Copy aria-hidden="true" />
          </span>
          <div>
            <h2 id="bulk-pricing-title" className="text-xl font-black text-primary">
              {t("bulkTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("bulkDescription")}</p>
          </div>
        </div>
        <form action={previewBulkPricingAction.bind(null, locale)} className="mt-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <CountrySelect
              name="sourceCountry"
              label={t("source")}
              countries={data.countries}
              locale={locale}
              defaultValue={data.bulk?.sourceCountry ?? "ZZ"}
            />
            <CountrySelect
              name="targetCountry"
              label={t("target")}
              countries={data.countries}
              locale={locale}
              defaultValue={data.bulk?.targetCountry ?? "EG"}
            />
            <Field
              id="multiplier"
              name="multiplier"
              label={t("multiplier")}
              defaultValue={String(data.bulk?.multiplier ?? 1)}
            />
            <Field
              id="roundTo"
              name="roundTo"
              label={t("roundTo")}
              defaultValue={String(data.bulk?.roundTo ?? 1)}
            />
            <div className="grid gap-2">
              <Label htmlFor="validFrom">{t("validFromUtc")}</Label>
              <Input
                id="validFrom"
                name="validFrom"
                type="datetime-local"
                defaultValue={dateValue}
                required
              />
            </div>
          </div>
          <fieldset className="rounded-2xl border p-4">
            <legend className="px-2 font-bold text-primary">{t("scope")}</legend>
            <p className="mb-3 text-xs text-muted-foreground">{t("scopeHint")}</p>
            <div className="flex flex-wrap gap-3">
              {data.packages.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3"
                >
                  <input
                    type="checkbox"
                    name="packageIds"
                    value={item.id}
                    defaultChecked={data.bulk?.packageIds.includes(item.id)}
                  />
                  <span className="text-sm font-bold">{localized(item)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end">
            <AdminSubmitButton
              label={t("preview")}
              pendingLabel={t("previewing")}
              variant="outline"
            />
          </div>
        </form>
        {data.bulk ? (
          <div className="mt-6 rounded-2xl border border-secondary/35 bg-secondary/5 p-4">
            <h3 className="font-black text-primary">{t("impactTitle")}</h3>
            {data.preview.length ? (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="border-b text-start text-muted-foreground">
                        <th className="p-3 text-start">{t("package")}</th>
                        <th className="p-3 text-start">{t("oldPrice")}</th>
                        <th className="p-3 text-start">{t("newPrice")}</th>
                        <th className="p-3 text-start">{t("activeSubscriptions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.preview.map((item) => (
                        <tr key={item.package.id} className="border-b last:border-0">
                          <td className="p-3 font-bold">{localized(item.package)}</td>
                          <td className="p-3" dir="ltr">
                            {item.source.amount} {item.source.currency}
                          </td>
                          <td className="p-3 font-black text-secondary" dir="ltr">
                            {item.amount}{" "}
                            {
                              data.countries.find(
                                (country) => country.code === data.bulk?.targetCountry,
                              )?.currency
                            }
                          </td>
                          <td className="p-3">
                            {item.activeSubscriptions} · {t("preserved")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <form
                  action={confirmBulkPricingAction.bind(null, locale)}
                  className="mt-4 flex justify-end"
                >
                  {hiddenBulk(data.bulk)}
                  <AdminSubmitButton label={t("confirmBulk")} pendingLabel={t("saving")} />
                </form>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("previewEmpty")}</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="grid-title">
        <div className="flex items-center gap-2">
          <Grid3X3 className="size-5 text-secondary" aria-hidden="true" />
          <h2 id="grid-title" className="text-xl font-black text-primary">
            {t("gridTitle")}
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("gridHint")}</p>
        <div className="mt-4 overflow-x-auto rounded-3xl border bg-card shadow-card">
          <table className="min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky start-0 z-20 min-w-56 border-e border-b bg-card p-4 text-start">
                  {t("package")}
                </th>
                {data.countries.map((country) => (
                  <th key={country.code} className="min-w-36 border-e border-b p-3 text-center">
                    <span className="block font-black">{country.code}</span>
                    <span className="text-xs text-muted-foreground">{country.currency}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.packages.map((item) => (
                <tr key={item.id}>
                  <th className="sticky start-0 z-10 border-e border-b bg-card p-4 text-start">
                    <span className="block font-black text-primary">{localized(item)}</span>
                    <Badge variant={item.is_published ? "success" : "secondary"}>
                      {item.is_published ? t("published") : t("draft")}
                    </Badge>
                  </th>
                  {data.countries.map((country) => {
                    const price = data.current.get(`${item.id}:${country.code}`);
                    return (
                      <td key={country.code} className="border-e border-b p-2 align-top">
                        <details>
                          <summary className="min-h-11 cursor-pointer list-none rounded-xl bg-background px-3 py-2 text-center">
                            <span className="font-black" dir="ltr">
                              {price?.is_active ? price.amount : "—"}
                            </span>
                            {price && !price.is_active ? (
                              <span className="block text-xs text-destructive">
                                {t("disabled")}
                              </span>
                            ) : null}
                          </summary>
                          <form
                            action={appendPriceAction.bind(null, locale)}
                            className="mt-2 grid gap-2 rounded-xl border bg-background p-3"
                          >
                            <input type="hidden" name="packageId" value={item.id} />
                            <input type="hidden" name="countryCode" value={country.code} />
                            <input type="hidden" name="currency" value={country.currency} />
                            <input type="hidden" name="validFrom" value={data.now} />
                            <Label className="sr-only" htmlFor={`${item.id}-${country.code}`}>
                              {t("newPrice")}
                            </Label>
                            <Input
                              id={`${item.id}-${country.code}`}
                              name="amount"
                              inputMode="decimal"
                              placeholder={String(price?.amount ?? "0.00")}
                              required
                            />
                            <AdminSubmitButton
                              label={t("saveCell")}
                              pendingLabel={t("saving")}
                              variant="outline"
                            />
                          </form>
                        </details>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.scheduled.length ? (
        <section
          className="mt-8 rounded-3xl border bg-card p-5 shadow-card"
          aria-labelledby="scheduled-title"
        >
          <h2
            id="scheduled-title"
            className="flex items-center gap-2 text-xl font-black text-primary"
          >
            <CalendarClock className="size-5 text-secondary" aria-hidden="true" />
            {t("scheduledTitle")}
          </h2>
          <div className="mt-4 grid gap-2">
            {data.scheduled.map((price) => {
              const packageItem = data.packages.find((item) => item.id === price.package_id);
              return (
                <div
                  key={price.id}
                  className="flex flex-wrap justify-between gap-3 rounded-xl bg-background p-3 text-sm"
                >
                  <span>
                    {packageItem ? localized(packageItem) : price.package_id} · {price.country_code}
                  </span>
                  <strong dir="ltr">
                    {price.amount} {price.currency} ·{" "}
                    {DateTime.fromISO(price.valid_from).toUTC().toFormat("yyyy-MM-dd HH:mm 'UTC'")}
                  </strong>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} inputMode="decimal" defaultValue={defaultValue} required />
    </div>
  );
}
function CountrySelect({
  name,
  label,
  countries,
  locale,
  defaultValue,
}: {
  name: string;
  label: string;
  countries: Array<{ code: string; name_ar: string; name_en: string | null; currency: string }>;
  locale: AppLocale;
  defaultValue: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 rounded-xl border bg-background px-3"
      >
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {locale === "ar" ? country.name_ar : (country.name_en ?? country.name_ar)} ·{" "}
            {country.currency}
          </option>
        ))}
      </select>
    </div>
  );
}
function hiddenBulk(value: {
  sourceCountry: string;
  targetCountry: string;
  multiplier: number;
  roundTo: number;
  validFrom: string;
  packageIds: string[];
}) {
  return (
    <>
      <input type="hidden" name="sourceCountry" value={value.sourceCountry} />
      <input type="hidden" name="targetCountry" value={value.targetCountry} />
      <input type="hidden" name="multiplier" value={value.multiplier} />
      <input type="hidden" name="roundTo" value={value.roundTo} />
      <input type="hidden" name="validFrom" value={value.validFrom} />
      {value.packageIds.map((id) => (
        <input key={id} type="hidden" name="packageIds" value={id} />
      ))}
    </>
  );
}
