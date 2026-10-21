"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PackageWizardInput } from "@/lib/validators/packages";

type Policy = PackageWizardInput["policy"];
type Price = PackageWizardInput["prices"][number];

export function PackagePolicyStep({
  policy,
  onChange,
}: {
  policy: Policy;
  onChange: (policy: Policy) => void;
}) {
  const t = useTranslations("packageAdmin");
  const numericFields = [
    "cancel_notice_hours",
    "max_makeups_per_period",
    "makeup_valid_days",
    "late_tolerance_min",
    "partial_refund_pct",
    "max_pause_days",
  ] as const;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {numericFields.map((field) => (
        <div key={field} className="grid gap-2">
          <Label htmlFor={`policy-${field}`}>{t(`fields.${field}`)}</Label>
          <Input
            id={`policy-${field}`}
            type="number"
            min="0"
            max={field === "partial_refund_pct" ? 100 : undefined}
            value={policy[field]}
            onChange={(event) => onChange({ ...policy, [field]: Number(event.target.value) })}
          />
        </div>
      ))}
      {(["student_no_show_consumes_credit", "student_no_show_pays_teacher"] as const).map(
        (field) => (
          <label
            key={field}
            className="flex min-h-12 items-center gap-3 rounded-xl border bg-background px-4 text-sm font-bold text-primary"
          >
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={policy[field]}
              onChange={(event) => onChange({ ...policy, [field]: event.target.checked })}
            />
            {t(`fields.${field}`)}
          </label>
        ),
      )}
      <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-background px-4 text-sm font-bold text-primary">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={policy.trial.enabled}
          onChange={(event) =>
            onChange({ ...policy, trial: { ...policy.trial, enabled: event.target.checked } })
          }
        />
        {t("fields.trialEnabled")}
      </label>
      <div className="grid gap-2">
        <Label htmlFor="policy-trial-price">{t("fields.trialPrice")}</Label>
        <Input
          id="policy-trial-price"
          type="number"
          min="0"
          max="100"
          value={policy.trial.price_pct}
          onChange={(event) =>
            onChange({
              ...policy,
              trial: { ...policy.trial, price_pct: Number(event.target.value) },
            })
          }
        />
      </div>
    </div>
  );
}

export function PackagePricesStep({
  prices,
  countries,
  validFrom,
  onChange,
}: {
  prices: Price[];
  countries: Array<{ code: string; name: string; currency: string }>;
  validFrom: string;
  onChange: (prices: Price[]) => void;
}) {
  const t = useTranslations("packageAdmin");
  const available = countries.filter(
    (country) => !prices.some((price) => price.country_code === country.code),
  );
  function update(index: number, patch: Partial<Price>) {
    onChange(
      prices.map((price, priceIndex) => (priceIndex === index ? { ...price, ...patch } : price)),
    );
  }
  function addCountry(code: string) {
    const country = countries.find((item) => item.code === code);
    if (!country) return;
    onChange([
      ...prices,
      {
        country_code: country.code,
        currency: country.currency,
        amount: "0",
        min_amount: "",
        max_amount: "",
        is_active: true,
        valid_from: validFrom,
      },
    ]);
  }
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-56 flex-1 gap-2">
          <Label htmlFor="add-price-country">{t("fields.addCountry")}</Label>
          <select
            id="add-price-country"
            className="h-11 rounded-lg border bg-card px-3 text-sm font-bold text-primary"
            defaultValue=""
            onChange={(event) => {
              addCountry(event.target.value);
              event.target.value = "";
            }}
          >
            <option value="" disabled>
              {t("actions.chooseCountry")}
            </option>
            {available.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} · {country.currency}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3">
        {prices.map((price, index) => {
          const country = countries.find((item) => item.code === price.country_code);
          return (
            <article
              key={price.country_code}
              className="grid gap-4 rounded-2xl border bg-background p-4 lg:grid-cols-[1.2fr_repeat(3,1fr)_auto] lg:items-end"
            >
              <div>
                <p className="font-black text-primary">{country?.name ?? price.country_code}</p>
                <p className="mt-1 text-xs text-muted-foreground">{price.currency}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`price-${index}`}>{t("fields.amount")}</Label>
                <Input
                  id={`price-${index}`}
                  inputMode="decimal"
                  value={price.amount}
                  onChange={(event) => update(index, { amount: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`min-${index}`}>{t("fields.minAmount")}</Label>
                <Input
                  id={`min-${index}`}
                  inputMode="decimal"
                  value={price.min_amount}
                  onChange={(event) => update(index, { min_amount: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`max-${index}`}>{t("fields.maxAmount")}</Label>
                <Input
                  id={`max-${index}`}
                  inputMode="decimal"
                  value={price.max_amount}
                  onChange={(event) => update(index, { max_amount: event.target.value })}
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("actions.removeCountry", {
                  country: country?.name ?? price.country_code,
                })}
                disabled={price.country_code === "ZZ"}
                onClick={() => onChange(prices.filter((_, priceIndex) => priceIndex !== index))}
              >
                <Minus aria-hidden="true" />
              </Button>
            </article>
          );
        })}
      </div>
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("allCountriesAdded")}</p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Plus className="size-4" aria-hidden="true" /> {t("priceHint")}
        </p>
      )}
    </div>
  );
}
