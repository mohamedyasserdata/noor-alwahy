import { BarChart3, Download, WalletCards } from "lucide-react";
import { DateTime } from "luxon";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { createExpenseAction, voidExpenseAction } from "@/lib/billing/actions";
import type { getFinanceAdminData } from "@/lib/billing/queries";

type FinanceData = Awaited<ReturnType<typeof getFinanceAdminData>>;

export async function FinancialReportsAdmin({
  locale,
  data,
}: {
  locale: AppLocale;
  data: FinanceData;
}) {
  const t = await getTranslations({ locale, namespace: "financeAdmin" });
  const today = DateTime.utc().toISODate() ?? "";
  const money = (value: number | string, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value));
  return (
    <div className="mt-8 grid gap-6">
      <section
        className="rounded-3xl border bg-card p-5 shadow-card sm:p-7"
        aria-labelledby="summary-title"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2
              id="summary-title"
              className="flex items-center gap-2 text-xl font-black text-primary"
            >
              <BarChart3 className="size-5 text-secondary" aria-hidden="true" />
              {t("summaryTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("summaryHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/admin/finance/export?format=pdf&locale=${locale}`}>
                <Download aria-hidden="true" /> PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/admin/finance/export?format=xlsx&locale=${locale}`}>
                <Download aria-hidden="true" /> Excel
              </a>
            </Button>
          </div>
        </header>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {data.summary.map((row) => (
            <article key={row.currency} className="rounded-2xl border bg-background p-4">
              <h3 className="font-black text-primary">{row.currency}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Metric label={t("invoiced")} value={money(row.invoiced ?? 0, row.currency!)} />
                <Metric label={t("received")} value={money(row.received ?? 0, row.currency!)} />
                <Metric label={t("refunded")} value={money(row.refunded ?? 0, row.currency!)} />
                <Metric label={t("expenses")} value={money(row.expenses ?? 0, row.currency!)} />
                <Metric
                  label={t("outstanding")}
                  value={money(row.outstanding ?? 0, row.currency!)}
                />
                <Metric label={t("netCash")} value={money(row.net_cash ?? 0, row.currency!)} />
              </dl>
            </article>
          ))}
          {!data.summary.length ? (
            <p className="text-sm text-muted-foreground">{t("emptySummary")}</p>
          ) : null}
        </div>
      </section>

      <section
        className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]"
        aria-labelledby="expenses-title"
      >
        <form
          action={createExpenseAction.bind(null, locale)}
          className="rounded-3xl border bg-card p-5 shadow-card"
        >
          <h2
            id="expenses-title"
            className="flex items-center gap-2 text-xl font-black text-primary"
          >
            <WalletCards className="size-5 text-secondary" aria-hidden="true" />
            {t("recordExpense")}
          </h2>
          <div className="mt-5 grid gap-3">
            <Field label={t("expenseCategory")} id="expense-category">
              <select
                id="expense-category"
                name="category"
                className="min-h-11 rounded-xl border bg-background px-3"
                required
              >
                {(
                  ["marketing", "software", "bank_fees", "rent", "equipment", "other"] as const
                ).map((category) => (
                  <option key={category} value={category}>
                    {t(`expenseCategories.${category}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("expenseDescription")} id="expense-description">
              <Input
                id="expense-description"
                name="description"
                minLength={2}
                maxLength={500}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("amount")} id="expense-amount">
                <Input id="expense-amount" name="amount" inputMode="decimal" required />
              </Field>
              <Field label={t("currency")} id="expense-currency">
                <Input
                  id="expense-currency"
                  name="currency"
                  minLength={3}
                  maxLength={3}
                  defaultValue="USD"
                  required
                />
              </Field>
            </div>
            <Field label={t("incurredOn")} id="expense-date">
              <Input
                id="expense-date"
                name="incurredOn"
                type="date"
                defaultValue={today}
                max={today}
                required
              />
            </Field>
            <Field label={t("payee")} id="expense-payee">
              <Input id="expense-payee" name="payee" maxLength={200} />
            </Field>
            <Field label={t("reference")} id="expense-reference">
              <Input id="expense-reference" name="reference" maxLength={200} />
            </Field>
            <AdminSubmitButton label={t("saveExpense")} pendingLabel={t("savingExpense")} />
          </div>
        </form>
        <div className="grid content-start gap-3">
          {data.expenses.map((expense) => (
            <article key={expense.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {expense.expense_no}
                  </p>
                  <h3 className="mt-1 font-black text-primary">{expense.description}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {expense.incurred_on} · {t(`expenseCategories.${expense.category}`)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-black text-primary">
                    {money(expense.amount, expense.currency)}
                  </p>
                  <Badge variant={expense.status === "void" ? "destructive" : "success"}>
                    {t(`expenseStates.${expense.status}`)}
                  </Badge>
                </div>
              </div>
              {expense.status === "recorded" ? (
                <form
                  action={voidExpenseAction.bind(null, locale)}
                  className="mt-3 flex flex-wrap gap-2 border-t pt-3"
                >
                  <input type="hidden" name="expenseId" value={expense.id} />
                  <Input
                    name="reason"
                    minLength={2}
                    maxLength={500}
                    placeholder={t("voidReason")}
                    className="min-w-48 flex-1"
                    required
                  />
                  <AdminSubmitButton
                    label={t("voidExpense")}
                    pendingLabel={t("voidingExpense")}
                    variant="destructive"
                  />
                </form>
              ) : expense.void_reason ? (
                <p className="mt-3 text-sm text-destructive">{expense.void_reason}</p>
              ) : null}
            </article>
          ))}
          {!data.expenses.length ? (
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              {t("emptyExpenses")}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black text-primary" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
