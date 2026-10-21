import { Banknote, Download, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { decidePaymentAction, recordPaymentAction } from "@/lib/billing/actions";
import { getFinanceAdminData } from "@/lib/billing/queries";
import { PaymentMethodsAdmin } from "@/components/billing/payment-methods-admin";
import { FinancialReportsAdmin } from "@/components/billing/financial-reports-admin";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function FinanceAdminSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "financeAdmin" }),
    getFinanceAdminData(),
    searchParams,
  ]);
  const status = typeof query.financeStatus === "string" ? query.financeStatus : "";
  const error = typeof query.financeError === "string" ? query.financeError : "";
  const name = (item: { label_ar: string; label_en: string | null }) =>
    locale === "ar" ? item.label_ar : (item.label_en ?? item.label_ar);
  const money = (amount: number | string, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="finance-title">
      <header className="max-w-3xl">
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h1 id="finance-title" className="mt-3 text-3xl font-black text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
      </header>
      {status ? (
        <p className="mt-5 rounded-xl bg-success/10 p-4 font-bold text-success">
          {t(`notices.${status}` as "notices.payment_recorded")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-xl bg-destructive/10 p-4 font-bold text-destructive">
          {t(`errors.${error}` as "errors.record_failed")}
        </p>
      ) : null}
      <FinancialReportsAdmin locale={locale} data={data} />
      <div className="mt-8 grid gap-5">
        {data.invoices.length ? (
          data.invoices.map((invoice) => {
            const student = Array.isArray(invoice.students)
              ? invoice.students[0]
              : invoice.students;
            const balance = data.balances.find((item) => item.invoice_id === invoice.id);
            const invoicePayments = data.payments.filter((item) => item.invoice_id === invoice.id);
            const payable = invoice.status !== "draft" && invoice.status !== "void";
            return (
              <details
                key={invoice.id}
                className="rounded-3xl border bg-card shadow-card"
                open={
                  invoice.status === "issued" ||
                  invoice.status === "partially_paid" ||
                  invoice.status === "overdue"
                }
              >
                <summary className="flex min-h-20 cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {invoice.invoice_no}
                    </p>
                    <h2 className="mt-1 text-lg font-black text-primary">
                      {student?.full_name ?? t("unknownStudent")}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-end">
                      <p className="font-black text-primary">
                        {money(invoice.total, invoice.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("due")}: {money(balance?.due ?? invoice.total, invoice.currency)}
                      </p>
                    </div>
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
                </summary>
                <div className="grid gap-6 border-t p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_22rem]">
                  <div>
                    <h3 className="flex items-center gap-2 font-black text-primary">
                      <ReceiptText className="size-5 text-secondary" aria-hidden="true" />
                      {t("payments")}
                    </h3>
                    <div className="mt-4 grid gap-3">
                      {invoicePayments.length ? (
                        invoicePayments.map((payment) => (
                          <article
                            key={payment.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4"
                          >
                            <div>
                              <p className="font-bold text-primary">
                                {payment.kind === "refund" ? t("refund") : t("payment")} ·{" "}
                                {money(payment.amount, payment.currency)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {payment.proof_note || t("noProofNote")}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
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
                              {payment.status === "pending_confirmation" ? (
                                <>
                                  <Decision
                                    locale={locale}
                                    paymentId={payment.id}
                                    decision="confirmed"
                                    label={t("confirm")}
                                    pending={t("confirming")}
                                    icon="confirm"
                                  />
                                  <Decision
                                    locale={locale}
                                    paymentId={payment.id}
                                    decision="rejected"
                                    label={t("reject")}
                                    pending={t("rejecting")}
                                    icon="reject"
                                  />
                                </>
                              ) : null}
                              {payment.status === "confirmed" ? (
                                <Button asChild variant="outline" size="sm">
                                  <a href={`/api/pdf/receipts/${payment.id}?locale=${locale}`}>
                                    <Download aria-hidden="true" />
                                    {t("receipt")}
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                          {t("noPayments")}
                        </p>
                      )}
                    </div>
                  </div>
                  {payable ? (
                    <form
                      action={recordPaymentAction.bind(null, locale)}
                      className="rounded-2xl border bg-background p-4"
                    >
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input type="hidden" name="currency" value={invoice.currency} />
                      <h3 className="flex items-center gap-2 font-black text-primary">
                        <Banknote className="size-5 text-secondary" aria-hidden="true" />
                        {t("recordTitle")}
                      </h3>
                      <div className="mt-4 grid gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label htmlFor={`kind-${invoice.id}`}>{t("kind")}</Label>
                            <select
                              id={`kind-${invoice.id}`}
                              name="kind"
                              className="min-h-11 rounded-xl border bg-card px-3"
                            >
                              <option value="payment">{t("payment")}</option>
                              <option value="refund">{t("refund")}</option>
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`amount-${invoice.id}`}>{t("amount")}</Label>
                            <Input
                              id={`amount-${invoice.id}`}
                              name="amount"
                              inputMode="decimal"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`method-${invoice.id}`}>{t("method")}</Label>
                          <select
                            id={`method-${invoice.id}`}
                            name="paymentMethodId"
                            className="min-h-11 rounded-xl border bg-card px-3"
                          >
                            <option value="">{t("noMethod")}</option>
                            {data.methods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {name(method)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`proof-${invoice.id}`}>{t("proofNote")}</Label>
                          <textarea
                            id={`proof-${invoice.id}`}
                            name="proofNote"
                            maxLength={3000}
                            className="min-h-20 rounded-xl border bg-card p-3"
                          />
                        </div>
                        <AdminSubmitButton label={t("record")} pendingLabel={t("recording")} />
                      </div>
                    </form>
                  ) : null}
                </div>
              </details>
            );
          })
        ) : (
          <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </div>
      <PaymentMethodsAdmin locale={locale} data={data} />
    </section>
  );
}

function Decision({
  locale,
  paymentId,
  decision,
  label,
  pending,
  icon,
}: {
  locale: AppLocale;
  paymentId: string;
  decision: "confirmed" | "rejected";
  label: string;
  pending: string;
  icon: "confirm" | "reject";
}) {
  return (
    <form action={decidePaymentAction.bind(null, locale)}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="decision" value={decision} />
      <AdminSubmitButton
        label={label}
        pendingLabel={pending}
        variant={icon === "reject" ? "destructive" : "outline"}
      />
    </form>
  );
}
