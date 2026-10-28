import { CalendarRange, Coins, Download } from "lucide-react";
import { DateTime } from "luxon";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  addPayoutAdjustmentAction,
  generatePayoutsAction,
  saveTeacherRateAction,
  transitionPayoutAction,
} from "@/lib/payouts/actions";
import { getPayoutAdminData } from "@/lib/payouts/queries";

export async function TeacherPayoutsAdmin({ locale }: { locale: AppLocale }) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "payouts" }),
    getPayoutAdminData(),
  ]);
  const previous = DateTime.utc().minus({ months: 1 });
  const name = (value: { name_ar: string; name_en: string | null }) =>
    locale === "ar" ? value.name_ar : (value.name_en ?? value.name_ar);
  const teacherName = (teacher: {
    profile: { full_name: string } | { full_name: string }[] | null;
  }) => {
    const profile = Array.isArray(teacher.profile) ? teacher.profile[0] : teacher.profile;
    return profile?.full_name ?? t("unknownTeacher");
  };
  const money = (value: number | string, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value));
  return (
    <section className="mt-8 grid gap-6" aria-labelledby="payouts-title">
      <header>
        <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
        <h2 id="payouts-title" className="mt-2 text-2xl font-black text-primary">
          {t("title")}
        </h2>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </header>
      <div className="grid gap-5 xl:grid-cols-2">
        <form
          action={saveTeacherRateAction.bind(null, locale)}
          className="rounded-3xl border bg-card p-5 shadow-card"
        >
          <h3 className="flex items-center gap-2 font-black text-primary">
            <Coins className="size-5 text-secondary" aria-hidden="true" />
            {t("rateTitle")}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field id="rate-teacher" label={t("teacher")}>
              <select
                id="rate-teacher"
                name="teacherId"
                required
                className="min-h-11 rounded-xl border bg-background px-3"
              >
                <option value="">{t("chooseTeacher")}</option>
                {data.teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacherName(teacher)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="rate-track" label={t("track")}>
              <select
                id="rate-track"
                name="trackId"
                className="min-h-11 rounded-xl border bg-background px-3"
              >
                <option value="">{t("allTracks")}</option>
                {data.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {name(track)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="rate-duration" label={t("duration")}>
              <Input
                id="rate-duration"
                name="durationMin"
                type="number"
                min={10}
                max={120}
                placeholder={t("allDurations")}
              />
            </Field>
            <Field id="rate-amount" label={t("rate")}>
              <Input id="rate-amount" name="amount" inputMode="decimal" required />
            </Field>
            <Field id="rate-currency" label={t("currency")}>
              <Input
                id="rate-currency"
                name="currency"
                defaultValue="USD"
                minLength={3}
                maxLength={3}
                required
              />
            </Field>
            <Field id="rate-valid" label={t("validFrom")}>
              <Input
                id="rate-valid"
                name="validFrom"
                type="date"
                defaultValue={DateTime.utc().toISODate() ?? ""}
                required
              />
            </Field>
          </div>
          <div className="mt-4">
            <AdminSubmitButton label={t("saveRate")} pendingLabel={t("savingRate")} />
          </div>
        </form>
        <form
          action={generatePayoutsAction.bind(null, locale)}
          className="rounded-3xl border bg-card p-5 shadow-card"
        >
          <h3 className="flex items-center gap-2 font-black text-primary">
            <CalendarRange className="size-5 text-secondary" aria-hidden="true" />
            {t("generateTitle")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("generateHint")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field id="payout-start" label={t("periodStart")}>
              <Input
                id="payout-start"
                name="periodStart"
                type="date"
                defaultValue={previous.startOf("month").toISODate() ?? ""}
                required
              />
            </Field>
            <Field id="payout-end" label={t("periodEnd")}>
              <Input
                id="payout-end"
                name="periodEnd"
                type="date"
                defaultValue={previous.endOf("month").toISODate() ?? ""}
                required
              />
            </Field>
          </div>
          <div className="mt-4">
            <AdminSubmitButton label={t("generate")} pendingLabel={t("generating")} />
          </div>
        </form>
      </div>
      <details className="rounded-2xl border bg-card p-5">
        <summary className="cursor-pointer font-black text-primary">
          {t("rates", { count: data.rates.length })}
        </summary>
        <div className="mt-4 grid gap-2">
          {data.rates.map((rate) => {
            const teacher = Array.isArray(rate.teacher) ? rate.teacher[0] : rate.teacher;
            const track = Array.isArray(rate.track) ? rate.track[0] : rate.track;
            return (
              <div
                key={rate.id}
                className="flex flex-wrap justify-between gap-3 rounded-xl bg-background p-3 text-sm"
              >
                <span className="font-bold">
                  {teacher ? teacherName(teacher) : t("unknownTeacher")} ·{" "}
                  {track ? name(track) : t("allTracks")} · {rate.duration_min ?? t("allDurations")}
                </span>
                <span dir="ltr">
                  {money(rate.rate_per_session, rate.currency)} · {rate.valid_from}
                </span>
              </div>
            );
          })}
        </div>
      </details>
      <div className="grid gap-4">
        {data.payouts.map((payout) => {
          const teacher = Array.isArray(payout.teacher) ? payout.teacher[0] : payout.teacher;
          const items = data.items.filter((item) => item.payout_id === payout.id);
          const adjustments = data.adjustments.filter((item) => item.payout_id === payout.id);
          return (
            <article key={payout.id} className="rounded-3xl border bg-card p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {payout.payout_no}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-primary">
                    {teacher ? teacherName(teacher) : t("unknownTeacher")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {payout.period_start} — {payout.period_end} ·{" "}
                    {t("sessions", { count: items.length })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-xl font-black text-primary">
                    {money(payout.net, payout.currency)}
                  </p>
                  <Badge variant={payout.status === "paid" ? "success" : "secondary"}>
                    {t(`states.${payout.status}`)}
                  </Badge>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Metric label={t("gross")} value={money(payout.gross, payout.currency)} />
                <Metric label={t("bonuses")} value={money(payout.bonuses, payout.currency)} />
                <Metric label={t("deductions")} value={money(payout.deductions, payout.currency)} />
                <Metric label={t("net")} value={money(payout.net, payout.currency)} />
              </dl>
              {adjustments.length ? (
                <ul className="mt-3 text-sm text-muted-foreground">
                  {adjustments.map((adjustment) => (
                    <li key={adjustment.id}>
                      {t(`adjustmentKinds.${adjustment.kind}`)} ·{" "}
                      {money(adjustment.amount, payout.currency)} · {adjustment.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
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
                {payout.status === "due" ? (
                  <form action={transitionPayoutAction.bind(null, locale)}>
                    <input type="hidden" name="payoutId" value={payout.id} />
                    <input type="hidden" name="action" value="approve" />
                    <AdminSubmitButton
                      label={t("approve")}
                      pendingLabel={t("approving")}
                      confirmation={{
                        kind: "approvePayout",
                        record: payout.payout_no,
                        details: [
                          { label: "amount", value: String(payout.net) },
                          { label: "currency", value: payout.currency },
                          {
                            label: "period",
                            value: `${payout.period_start} — ${payout.period_end}`,
                          },
                        ],
                      }}
                    />
                  </form>
                ) : null}
              </div>
              {payout.status === "accruing" || payout.status === "due" ? (
                <form
                  action={addPayoutAdjustmentAction.bind(null, locale)}
                  className="mt-4 grid gap-2 rounded-xl border p-3 sm:grid-cols-4"
                >
                  <input type="hidden" name="payoutId" value={payout.id} />
                  <select name="kind" className="min-h-11 rounded-xl border bg-background px-3">
                    <option value="bonus">{t("adjustmentKinds.bonus")}</option>
                    <option value="deduction">{t("adjustmentKinds.deduction")}</option>
                  </select>
                  <Input name="amount" inputMode="decimal" placeholder={t("amount")} required />
                  <Input
                    name="reason"
                    minLength={2}
                    maxLength={500}
                    placeholder={t("reason")}
                    required
                  />
                  <AdminSubmitButton
                    label={t("addAdjustment")}
                    pendingLabel={t("addingAdjustment")}
                  />
                </form>
              ) : null}
              {payout.status === "approved" ? (
                <form
                  action={transitionPayoutAction.bind(null, locale)}
                  className="mt-4 flex flex-wrap gap-2 rounded-xl border p-3"
                >
                  <input type="hidden" name="payoutId" value={payout.id} />
                  <input type="hidden" name="action" value="pay" />
                  <Input
                    name="reference"
                    minLength={2}
                    maxLength={200}
                    placeholder={t("paymentReference")}
                    className="min-w-52 flex-1"
                    required
                  />
                  <AdminSubmitButton
                    label={t("markPaid")}
                    pendingLabel={t("markingPaid")}
                    confirmation={{
                      kind: "payPayout",
                      record: payout.payout_no,
                      details: [
                        { label: "amount", value: String(payout.net) },
                        { label: "currency", value: payout.currency },
                        {
                          label: "period",
                          value: `${payout.period_start} — ${payout.period_end}`,
                        },
                      ],
                    }}
                  />
                </form>
              ) : null}
            </article>
          );
        })}
        {!data.payouts.length ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            {t("empty")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black text-primary" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
