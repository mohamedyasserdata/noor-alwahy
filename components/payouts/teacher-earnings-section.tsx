import { CalendarDays, ClipboardCheck, Download, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  TeacherMetricCard,
  TeacherPageHeader,
  TeacherPanel,
} from "@/components/teacher/teacher-page-ui";
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
  const latest = payouts[0];
  const paid = payouts.filter((item) => item.status === "paid");
  const pending = payouts.filter((item) => item.status !== "paid");
  const maxNet = Math.max(1, ...payouts.map((item) => Number(item.net ?? 0)));

  return (
    <section className="teacher-reference-page" aria-labelledby="earnings-title">
      <div id="earnings-title">
        <TeacherPageHeader
          eyebrow={t("teacherEyebrow")}
          title={t("teacherTitle")}
          description={t("teacherDescription")}
          icon={WalletCards}
        />
      </div>
      <div className="teacher-metrics-grid mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeacherMetricCard
          icon={WalletCards}
          label={t("net")}
          value={latest ? money(latest.net ?? 0, latest.currency!) : "—"}
          detail={
            latest
              ? `${latest.period_start ?? "—"} — ${latest.period_end ?? "—"}`
              : t("teacherEmpty")
          }
          tone="gold"
        />
        <TeacherMetricCard
          icon={ClipboardCheck}
          label={t("states.paid")}
          value={paid.length}
          tone="green"
        />
        <TeacherMetricCard icon={ClipboardCheck} label={t("states.due")} value={pending.length} />
        <TeacherMetricCard
          icon={CalendarDays}
          label={t("sessions", { count: latest?.session_count ?? 0 })}
          value={latest?.session_count ?? 0}
          tone="violet"
        />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TeacherPanel title={t("teacherTitle")}>
          {payouts.length ? (
            <div className="flex h-64 items-end gap-3 border-b border-secondary/20 px-2 pb-3">
              {payouts
                .slice(0, 6)
                .toReversed()
                .map((payout) => (
                  <div
                    key={payout.id}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span
                      className="w-full max-w-12 rounded-t-lg bg-secondary"
                      style={{
                        height: `${Math.max(12, (Number(payout.net ?? 0) / maxNet) * 180)}px`,
                      }}
                      title={money(payout.net ?? 0, payout.currency!)}
                    />
                    <span className="max-w-full truncate text-xs text-muted-foreground" dir="ltr">
                      {payout.period_end?.slice(0, 7) ?? "—"}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <Empty>{t("teacherEmpty")}</Empty>
          )}
        </TeacherPanel>
        <TeacherPanel title={t("states.due")}>
          {latest ? (
            <dl className="divide-y divide-secondary/15">
              <Metric label={t("gross")} value={money(latest.gross ?? 0, latest.currency!)} />
              <Metric label={t("bonuses")} value={money(latest.bonuses ?? 0, latest.currency!)} />
              <Metric
                label={t("deductions")}
                value={money(latest.deductions ?? 0, latest.currency!)}
              />
              <Metric label={t("net")} value={money(latest.net ?? 0, latest.currency!)} />
            </dl>
          ) : (
            <Empty>{t("teacherEmpty")}</Empty>
          )}
        </TeacherPanel>
      </div>
      <TeacherPanel className="mt-5" title={t("teacherTitle")}>
        {payouts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-start">#</th>
                  <th className="px-4 py-3 text-start">{t("sessions", { count: 0 })}</th>
                  <th className="px-4 py-3 text-start">{t("net")}</th>
                  <th className="px-4 py-3 text-start">{t("states.paid")}</th>
                  <th className="px-4 py-3 text-start">PDF / Excel</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-secondary/15 last:border-0">
                    <td className="px-4 py-4 font-mono text-xs" dir="ltr">
                      {payout.payout_no}
                    </td>
                    <td className="px-4 py-4">{payout.session_count ?? 0}</td>
                    <td className="px-4 py-4 font-black text-primary">
                      {money(payout.net ?? 0, payout.currency!)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={payout.status === "paid" ? "success" : "secondary"}>
                        {t(`states.${payout.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("teacherEmpty")}</Empty>
        )}
      </TeacherPanel>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-black text-primary" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-secondary/30 p-8 text-center text-muted-foreground">
      {children}
    </p>
  );
}
