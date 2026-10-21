import { Download, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import { getMyEarnings } from "@/lib/payouts/queries";

export async function TeacherEarningsSection({ locale }: { locale: AppLocale }) {
  const [t, payouts] = await Promise.all([
    getTranslations({ locale, namespace: "payouts" }),
    getMyEarnings(),
  ]);
  const money = (value: number | string, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value));
  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="earnings-title">
      <header className="max-w-3xl">
        <p className="text-sm font-black text-secondary">{t("teacherEyebrow")}</p>
        <h1 id="earnings-title" className="mt-3 text-3xl font-black text-primary sm:text-4xl">
          {t("teacherTitle")}
        </h1>
        <p className="mt-4 leading-8 text-muted-foreground">{t("teacherDescription")}</p>
      </header>
      <div className="mt-8 grid gap-4">
        {payouts.map((payout) => (
          <article key={payout.id} className="rounded-3xl border bg-card p-5 shadow-card">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <WalletCards className="size-6 text-secondary" aria-hidden="true" />
                <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">
                  {payout.payout_no}
                </p>
                <h2 className="font-black text-primary">
                  {payout.period_start} — {payout.period_end}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("sessions", { count: payout.session_count ?? 0 })}
                </p>
              </div>
              <div className="text-end">
                <p className="text-2xl font-black text-primary">
                  {money(payout.net ?? 0, payout.currency!)}
                </p>
                <Badge variant={payout.status === "paid" ? "success" : "secondary"}>
                  {t(`states.${payout.status}`)}
                </Badge>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label={t("gross")} value={money(payout.gross ?? 0, payout.currency!)} />
              <Metric label={t("bonuses")} value={money(payout.bonuses ?? 0, payout.currency!)} />
              <Metric
                label={t("deductions")}
                value={money(payout.deductions ?? 0, payout.currency!)}
              />
              <Metric label={t("net")} value={money(payout.net ?? 0, payout.currency!)} />
            </dl>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/payouts/${payout.id}/export?format=pdf&locale=${locale}`}>
                  <Download aria-hidden="true" />
                  PDF
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/payouts/${payout.id}/export?format=xlsx&locale=${locale}`}>
                  <Download aria-hidden="true" />
                  Excel
                </a>
              </Button>
            </div>
          </article>
        ))}
        {!payouts.length ? (
          <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
            {t("teacherEmpty")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black text-primary" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
