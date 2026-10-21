import { Landmark } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { savePaymentMethodAction, togglePaymentMethodAction } from "@/lib/billing/actions";
import type { getFinanceAdminData } from "@/lib/billing/queries";

type FinanceData = Awaited<ReturnType<typeof getFinanceAdminData>>;

export async function PaymentMethodsAdmin({
  locale,
  data,
}: {
  locale: AppLocale;
  data: FinanceData;
}) {
  const t = await getTranslations({ locale, namespace: "financeAdmin.methodsAdmin" });
  return (
    <section className="mt-12" aria-labelledby="payment-methods-title">
      <header className="max-w-3xl">
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h2 id="payment-methods-title" className="mt-2 text-2xl font-black text-primary">
          {t("title")}
        </h2>
        <p className="mt-3 leading-7 text-muted-foreground">{t("description")}</p>
      </header>
      <details className="mt-6 rounded-3xl border bg-card shadow-card">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 font-black text-primary">
          <Landmark className="size-5 text-secondary" aria-hidden="true" />
          {t("add")}
        </summary>
        <MethodForm locale={locale} countries={data.countries} t={t} />
      </details>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {data.methods.map((method) => (
          <details key={method.id} className="rounded-2xl border bg-card shadow-card">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5">
              <div>
                <p className="font-black text-primary">
                  {locale === "ar" ? method.label_ar : (method.label_en ?? method.label_ar)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {method.country_code} · {t(`types.${method.type}`)}
                </p>
              </div>
              <Badge variant={method.is_active ? "success" : "secondary"}>
                {method.is_active ? t("active") : t("inactive")}
              </Badge>
            </summary>
            <MethodForm locale={locale} countries={data.countries} method={method} t={t} />
            <form action={togglePaymentMethodAction.bind(null, locale)} className="border-t p-5">
              <input type="hidden" name="id" value={method.id} />
              <input type="hidden" name="isActive" value={method.is_active ? "false" : "true"} />
              <AdminSubmitButton
                label={method.is_active ? t("disable") : t("enable")}
                pendingLabel={t("saving")}
                variant={method.is_active ? "destructive" : "outline"}
              />
            </form>
          </details>
        ))}
      </div>
    </section>
  );
}

function MethodForm({
  locale,
  countries,
  method,
  t,
}: {
  locale: AppLocale;
  countries: FinanceData["countries"];
  method?: FinanceData["methods"][number];
  t: (key: string) => string;
}) {
  const details = asDetails(method?.details);
  const prefix = method?.id ?? "new";
  return (
    <form action={savePaymentMethodAction.bind(null, locale)} className="grid gap-4 border-t p-5">
      <input type="hidden" name="id" value={method?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id={`${prefix}-country`}
          name="countryCode"
          label={t("country")}
          defaultValue={method?.country_code}
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {locale === "ar" ? country.name_ar : (country.name_en ?? country.name_ar)} ·{" "}
              {country.code}
            </option>
          ))}
        </Select>
        <Select
          id={`${prefix}-type`}
          name="type"
          label={t("type")}
          defaultValue={method?.type ?? "bank"}
        >
          {["bank", "wallet", "instapay", "cash", "other"].map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </Select>
        <Text
          id={`${prefix}-label-ar`}
          name="labelAr"
          label={t("labelAr")}
          value={method?.label_ar}
          required
        />
        <Text
          id={`${prefix}-label-en`}
          name="labelEn"
          label={t("labelEn")}
          value={method?.label_en}
        />
        <Text
          id={`${prefix}-account-name`}
          name="accountName"
          label={t("accountName")}
          value={details.account_name}
        />
        <Text
          id={`${prefix}-account-number`}
          name="accountNumber"
          label={t("accountNumber")}
          value={details.account_number}
        />
        <Text id={`${prefix}-iban`} name="iban" label={t("iban")} value={details.iban} />
        <Text id={`${prefix}-phone`} name="phone" label={t("phone")} value={details.phone} />
        <Text id={`${prefix}-branch`} name="branch" label={t("branch")} value={details.branch} />
        <Text
          id={`${prefix}-reference`}
          name="referenceHint"
          label={t("referenceHint")}
          value={details.reference_hint}
        />
        <Text
          id={`${prefix}-sort`}
          name="sortOrder"
          label={t("sortOrder")}
          value={String(method?.sort_order ?? 0)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Area
          id={`${prefix}-instructions-ar`}
          name="instructionsAr"
          label={t("instructionsAr")}
          value={method?.instructions_ar}
        />
        <Area
          id={`${prefix}-instructions-en`}
          name="instructionsEn"
          label={t("instructionsEn")}
          value={method?.instructions_en}
        />
      </div>
      <AdminSubmitButton label={t("save")} pendingLabel={t("saving")} />
    </form>
  );
}

function Text({
  id,
  name,
  label,
  value,
  required,
}: {
  id: string;
  name: string;
  label: string;
  value?: string | null;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={value ?? ""} maxLength={300} required={required} />
    </div>
  );
}
function Area({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={name}
        defaultValue={value ?? ""}
        maxLength={3000}
        className="min-h-24 rounded-xl border bg-background p-3"
      />
    </div>
  );
}
function Select({
  id,
  name,
  label,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? undefined}
        className="min-h-11 rounded-xl border bg-background px-3"
        required
      >
        {children}
      </select>
    </div>
  );
}
function asDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
