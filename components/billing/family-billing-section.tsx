import { Banknote, CreditCard, Download, Landmark, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentPageShell } from "@/components/student/student-page-shell";
import type { AppLocale } from "@/i18n/routing";
import { getFamilyBillingData } from "@/lib/billing/family-queries";

export async function FamilyBillingSection({
  appearance = "standard",
  locale,
}: {
  appearance?: "standard" | "student";
  locale: AppLocale;
}) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "familyBilling" }),
    getFamilyBillingData(),
  ]);
  const money = (amount: number | string, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
  const content = (
    <section
      className={
        appearance === "student"
          ? "student-billing-page mx-auto w-full max-w-[94rem]"
          : "mx-auto w-full max-w-6xl"
      }
      aria-labelledby={appearance === "standard" ? "billing-title" : undefined}
      aria-label={appearance === "student" ? t("title") : undefined}
    >
      {appearance === "standard" ? (
        <header className="max-w-3xl">
          <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1 id="billing-title" className="mt-3 text-3xl font-black text-primary sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </header>
      ) : null}
      {data.statement.length ? (
        <section
          className="mt-8 rounded-3xl border bg-card p-5 shadow-card sm:p-7"
          aria-labelledby="statement-title"
        >
          <h2 id="statement-title" className="text-xl font-black text-primary">
            {t("statementTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("statementHint")}</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="p-3 text-start">{t("statementDate")}</th>
                  <th className="p-3 text-start">{t("statementReference")}</th>
                  <th className="p-3 text-end">{t("statementDebit")}</th>
                  <th className="p-3 text-end">{t("statementCredit")}</th>
                  <th className="p-3 text-end">{t("statementBalance")}</th>
                </tr>
              </thead>
              <tbody>
                {data.statement.map((entry, index) => (
                  <tr
                    key={`${entry.student_id}-${entry.reference}-${entry.entry_at}-${index}`}
                    className="border-b last:border-0"
                  >
                    <td className="p-3">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                        new Date(entry.entry_at!),
                      )}
                    </td>
                    <td className="p-3 font-mono" dir="ltr">
                      {entry.reference}
                    </td>
                    <td className="p-3 text-end" dir="ltr">
                      {Number(entry.debit) ? money(entry.debit!, entry.currency!) : "—"}
                    </td>
                    <td className="p-3 text-end" dir="ltr">
                      {Number(entry.credit) ? money(entry.credit!, entry.currency!) : "—"}
                    </td>
                    <td className="p-3 text-end font-black" dir="ltr">
                      {money(entry.running_balance!, entry.currency!)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <div className="mt-8 grid gap-5">
        {data.invoices.length ? (
          data.invoices.map((invoice) => {
            const student = Array.isArray(invoice.students)
              ? invoice.students[0]
              : invoice.students;
            const subscription = Array.isArray(invoice.subscriptions)
              ? invoice.subscriptions[0]
              : invoice.subscriptions;
            const country = subscription?.price_country ?? student?.country_code ?? "ZZ";
            const balance = data.balances.find((item) => item.invoice_id === invoice.id);
            const items = data.items.filter((item) => item.invoice_id === invoice.id);
            const payments = data.payments.filter((item) => item.invoice_id === invoice.id);
            const methods = data.methods.filter(
              (item) => item.country_code === country || item.country_code === "ZZ",
            );
            return (
              <article
                key={invoice.id}
                className="overflow-hidden rounded-3xl border bg-card shadow-card"
              >
                <header className="flex flex-wrap items-center justify-between gap-4 bg-primary px-5 py-5 text-primary-foreground sm:px-7">
                  <div>
                    <p className="font-mono text-xs text-primary-foreground/70" dir="ltr">
                      {invoice.invoice_no}
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      {student?.full_name ?? t("student")}
                    </h2>
                  </div>
                  <div className="text-end">
                    <p className="text-2xl font-black text-secondary">
                      {money(invoice.total, invoice.currency)}
                    </p>
                    <Badge
                      variant={
                        invoice.status === "paid"
                          ? "success"
                          : invoice.status === "overdue"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {t(`states.${invoice.status}`)}
                    </Badge>
                  </div>
                </header>
                <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-black text-primary">
                      <ReceiptText className="size-5 text-secondary" aria-hidden="true" />
                      {t("summary")}
                    </h3>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      <Value
                        label={t("subtotal")}
                        value={money(invoice.subtotal, invoice.currency)}
                      />
                      <Value
                        label={t("discount")}
                        value={money(invoice.discount_total, invoice.currency)}
                      />
                      <Value
                        label={t("paid")}
                        value={money(balance?.paid ?? 0, invoice.currency)}
                      />
                      <Value
                        label={t("due")}
                        value={money(balance?.due ?? invoice.total, invoice.currency)}
                      />
                    </dl>
                    <ul className="mt-5 grid gap-2">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between gap-3 rounded-xl bg-background p-3 text-sm"
                        >
                          <span>
                            {locale === "ar"
                              ? item.description_ar
                              : (item.description_en ?? item.description_ar)}
                          </span>
                          <strong dir="ltr">{money(item.amount ?? 0, invoice.currency)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 font-black text-primary">
                      <Landmark className="size-5 text-secondary" aria-hidden="true" />
                      {t("methods", { country })}
                    </h3>
                    <div className="mt-4 grid gap-3">
                      {methods.length ? (
                        methods.map((method) => (
                          <div key={method.id} className="rounded-2xl border bg-background p-4">
                            <p className="font-black text-primary">
                              {locale === "ar"
                                ? method.label_ar
                                : (method.label_en ?? method.label_ar)}
                            </p>
                            <MethodDetails details={method.details} t={t} />
                            <p className="mt-3 text-sm leading-7 whitespace-pre-wrap text-muted-foreground">
                              {locale === "ar"
                                ? method.instructions_ar
                                : (method.instructions_en ?? method.instructions_ar)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                          {t("noMethods")}
                        </p>
                      )}
                    </div>
                  </div>
                  {payments.length ? (
                    <div className="lg:col-span-2">
                      <h3 className="flex items-center gap-2 font-black text-primary">
                        <Banknote className="size-5 text-secondary" aria-hidden="true" />
                        {t("transactions")}
                      </h3>
                      <div className="mt-3 grid gap-2">
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                          >
                            <span>
                              {payment.kind === "refund" ? t("refund") : t("payment")} ·{" "}
                              <b dir="ltr">{money(payment.amount, payment.currency)}</b>
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  payment.status === "confirmed"
                                    ? "success"
                                    : payment.status === "rejected"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {t(`paymentStates.${payment.status}`)}
                              </Badge>
                              {payment.status === "confirmed" ? (
                                <Button asChild variant="outline" size="sm">
                                  <a href={`/api/pdf/receipts/${payment.id}?locale=${locale}`}>
                                    <Download aria-hidden="true" />
                                    {t("receipt")}
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-secondary/35 bg-card/96 p-12 text-center shadow-card">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-secondary/12 text-secondary">
              <ReceiptText className="size-8" aria-hidden="true" />
            </span>
            <p className="mt-4 text-muted-foreground">{t("empty")}</p>
          </div>
        )}
      </div>
    </section>
  );

  if (appearance === "student") {
    return (
      <StudentPageShell
        locale={locale}
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        titleId="billing-title"
        icon={CreditCard}
      >
        {content}
      </StudentPageShell>
    );
  }

  return content;
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black text-primary" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
function MethodDetails({ details, t }: { details: unknown; t: (key: string) => string }) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const entries = Object.entries(details as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]),
  );
  if (!entries.length) return null;
  return (
    <dl className="mt-3 grid gap-2 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
          <dt className="text-muted-foreground">{t(`details.${key}`)}</dt>
          <dd className="font-bold break-all" dir="auto">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
