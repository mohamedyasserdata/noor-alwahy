import {
  Banknote,
  CalendarCheck2,
  CircleAlert,
  ClipboardCheck,
  FileDown,
  GraduationCap,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAdminDashboardData, type AdminDashboardData } from "@/lib/dashboard/admin-dashboard";

type Query = Promise<Record<string, string | string[] | undefined>>;
export async function AdminDashboardSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const query = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(today.getUTCDate() - 89);
  const from = dateValue(query.from, defaultFrom.toISOString().slice(0, 10));
  const to = dateValue(query.to, today.toISOString().slice(0, 10));
  const country = codeValue(query.country, 2);
  const currency = codeValue(query.currency, 3);
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "adminDashboard" }),
    getAdminDashboardData({ from, to, country, currency }),
  ]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const exportParams = new URLSearchParams({ locale, from, to, country, currency });
  return (
    <section
      className="admin-dashboard mx-auto w-full max-w-7xl"
      aria-labelledby="admin-dashboard-title"
    >
      <header className="grid gap-6 border-b border-secondary/30 pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1
            id="admin-dashboard-title"
            className="mt-3 text-3xl font-black text-primary sm:text-4xl"
          >
            {t("title")}
          </h1>
          <p className="mt-4 max-w-3xl leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{t("period", { from, to })}</Badge>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <a href={`/api/admin/dashboard/export?${exportParams.toString()}&format=pdf`} download>
              <FileDown aria-hidden="true" />
              {t("exports.pdf")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <a href={`/api/admin/dashboard/export?${exportParams.toString()}&format=xlsx`} download>
              <FileDown aria-hidden="true" />
              {t("exports.xlsx")}
            </a>
          </Button>
        </div>
      </header>
      <details className="admin-dashboard-filter mt-6 overflow-hidden border bg-card shadow-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-black text-primary">{t("filters.title")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t("filters.description")}
            </span>
          </span>
          <Badge variant="secondary">{t("period", { from, to })}</Badge>
        </summary>
        <form className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Filter label={t("filters.from")} name="from" type="date" value={from} />
          <Filter label={t("filters.to")} name="to" type="date" value={to} />
          <Select
            label={t("filters.country")}
            name="country"
            value={country}
            all={t("filters.allCountries")}
            options={data.countries
              .filter((x) => x.country)
              .map((x) => ({ value: x.country!, label: `${x.country} · ${x.students}` }))}
          />
          <Select
            label={t("filters.currency")}
            name="currency"
            value={currency}
            all={t("filters.allCurrencies")}
            options={data.currencies.map((value) => ({ value, label: value }))}
          />
          <div className="flex items-end">
            <Button type="submit" variant="gold" className="w-full">
              {t("filters.apply")}
            </Button>
          </div>
        </form>
      </details>
      <div className="admin-dashboard-metrics mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Users />}
          label={t("metrics.students")}
          value={number.format(data.totals.students)}
        />
        <Metric
          icon={<GraduationCap />}
          label={t("metrics.teachers")}
          value={number.format(data.totals.teachers)}
        />
        <Metric
          icon={<UserRoundCheck />}
          label={t("metrics.subscriptions")}
          value={number.format(data.totals.active_subscriptions)}
        />
        <Metric
          icon={<CalendarCheck2 />}
          label={t("metrics.attendanceToday")}
          value={percent(data.totals.today_attendance, number)}
        />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <section className="border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff0d1] text-[#a76600]">
              <CircleAlert className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("attention.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("attention.description")}</p>
            </div>
          </div>
          <div className="mt-5 grid divide-y">
            <ActionRow
              href="/admin/applications"
              label={t("attention.newApplications")}
              value={number.format(data.totals.new_applications)}
            />
            <ActionRow
              href="/admin/reports"
              label={t("attention.riskFlags")}
              value={number.format(data.riskFlags.length)}
            />
            <ActionRow
              href="/admin/finance"
              label={t("attention.overdue")}
              value={moneyValues(data.overdue, locale)}
            />
          </div>
        </section>

        <section className="border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#dfedff] text-[#2563b8]">
              <ClipboardCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-black text-primary">{t("quickActions.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("quickActions.description")}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              { key: "applications", href: "/admin/applications" },
              { key: "subscriptions", href: "/admin/subscriptions" },
              { key: "schedule", href: "/admin/schedule" },
              { key: "reports", href: "/admin/reports" },
            ].map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className="flex min-h-12 items-center justify-center rounded-xl border border-secondary/20 bg-accent/25 px-3 py-2 text-center text-sm font-black text-primary transition-colors hover:border-secondary/45 hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t(`quickActions.${key}`)}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <details className="admin-dashboard-analytics mt-7 overflow-hidden border bg-card/65 shadow-card">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-lg font-black text-primary">{t("analytics.title")}</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("analytics.description")}
            </span>
          </span>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">
            {t("analytics.open")}
          </span>
        </summary>
        <div className="border-t border-secondary/20 p-4 sm:p-6">
          <div className="admin-dashboard-metrics grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={<TrendingUp />}
              label={t("metrics.conversion")}
              value={percent(data.conversion_rate, number)}
            />
            <Metric
              icon={<TrendingDown />}
              label={t("metrics.churn")}
              value={percent(data.churn_rate, number)}
            />
            <MoneyMetric
              icon={<Banknote />}
              label={t("metrics.mrr")}
              values={data.mrr}
              locale={locale}
            />
            <MoneyMetric
              icon={<Banknote />}
              label={t("metrics.overdue")}
              values={data.overdue}
              locale={locale}
            />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <ChartCard title={t("charts.attendance")}>
              <LineChart rows={data.attendance} />
            </ChartCard>
            <ChartCard title={t("charts.finance")}>
              <FinanceBars rows={data.finance} locale={locale} />
            </ChartCard>
            <ChartCard title={t("charts.levels")}>
              <LevelDonut rows={data.levels} locale={locale} />
            </ChartCard>
            <ChartCard title={t("charts.teachers")}>
              <TeacherBars rows={data.teachers} />
            </ChartCard>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ListCard
              title={t("packages.title")}
              empty={t("empty")}
              rows={data.packages.map((row) => ({
                label: locale === "ar" || !row.name_en ? row.name_ar : row.name_en,
                value: number.format(row.subscriptions),
              }))}
            />
            <ListCard
              title={t("activity.title")}
              empty={t("empty")}
              rows={data.recent_activity.map((row) => ({
                label: `${row.action} · ${row.table ?? "—"}`,
                value: new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(row.at)),
              }))}
            />
          </div>
          <section className="mt-6 border bg-card p-5 shadow-card sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-primary">{t("risk.title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("risk.description")}</p>
              </div>
              <Badge variant="secondary">{t("risk.count", { count: data.riskFlags.length })}</Badge>
            </div>
            {data.riskFlags.length ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-4xl border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      {[
                        "student",
                        "level",
                        "score",
                        "reasons",
                        "absence",
                        "inactive",
                        "reviews",
                      ].map((key) => (
                        <th key={key} scope="col" className="border p-3 text-start font-black">
                          {t(`risk.columns.${key}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.riskFlags.map((row) => (
                      <tr key={row.student_id} className="odd:bg-muted/35">
                        <td className="border p-3">
                          <b className="block text-primary">{row.full_name}</b>
                          <span className="text-xs text-muted-foreground" dir="ltr">
                            {row.student_no}
                          </span>
                        </td>
                        <td className="border p-3">
                          {locale === "ar" ? row.level_name_ar : row.level_name_en}
                        </td>
                        <td className="border p-3">
                          <Badge variant={row.risk_level === "high" ? "destructive" : "secondary"}>
                            {t(`risk.levels.${row.risk_level}`, { score: row.risk_score })}
                          </Badge>
                        </td>
                        <td className="border p-3">
                          <ul className="grid gap-1">
                            {row.reasons.map((reason) => (
                              <li key={reason}>{t(`risk.reasons.${reason}`)}</li>
                            ))}
                          </ul>
                        </td>
                        <td className="border p-3" dir="ltr">
                          {row.absence_rate == null ? "—" : `${number.format(row.absence_rate)}%`}
                        </td>
                        <td className="border p-3">{row.inactive_days ?? "—"}</td>
                        <td className="border p-3">{row.overdue_review_pages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 py-8 text-center text-muted-foreground">{t("risk.empty")}</p>
            )}
          </section>
        </div>
      </details>
    </section>
  );
}

function ActionRow({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="font-bold text-foreground">{label}</span>
      <span className="font-black text-primary" dir="auto">
        {value}
      </span>
    </Link>
  );
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="admin-metric-card border bg-card p-5 shadow-card">
      <span className="admin-metric-icon grid size-12 place-items-center rounded-full bg-primary text-secondary [&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-4 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black text-primary" dir="auto">
        {value}
      </p>
    </article>
  );
}
function MoneyMetric({
  icon,
  label,
  values,
  locale,
}: {
  icon: React.ReactNode;
  label: string;
  values: { currency: string; amount: number }[];
  locale: AppLocale;
}) {
  return (
    <article className="admin-metric-card border bg-card p-5 shadow-card">
      <span className="admin-metric-icon grid size-12 place-items-center rounded-full bg-primary text-secondary [&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-4 text-sm font-bold text-muted-foreground">{label}</p>
      <div className="mt-2 grid gap-1">
        {values.length ? (
          values.map((row) => (
            <p key={row.currency} className="text-lg font-black text-primary" dir="ltr">
              {new Intl.NumberFormat(locale, {
                style: "currency",
                currency: row.currency,
                maximumFractionDigits: 0,
              }).format(row.amount)}
            </p>
          ))
        ) : (
          <p className="text-2xl font-black text-primary">—</p>
        )}
      </div>
    </article>
  );
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border bg-card p-5 shadow-card sm:p-7">
      <h2 className="text-xl font-black text-primary">{title}</h2>
      <div className="mt-5 min-h-56">{children}</div>
    </section>
  );
}
function LineChart({ rows }: { rows: AdminDashboardData["attendance"] }) {
  if (!rows.length) return <Empty />;
  const points = rows
    .map(
      (row, index) =>
        `${rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100},${100 - (row.rate ?? 0)}`,
    )
    .join(" ");
  return (
    <div>
      <svg viewBox="0 0 100 105" role="img" className="h-52 w-full overflow-visible">
        <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" className="text-border" />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="text-secondary"
        />
        {rows.map((row, index) => (
          <circle
            key={row.day}
            cx={rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100}
            cy={100 - (row.rate ?? 0)}
            r="1.5"
            className="fill-primary"
          >
            <title>{`${row.day}: ${row.rate ?? 0}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
function FinanceBars({ rows, locale }: { rows: AdminDashboardData["finance"]; locale: AppLocale }) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.flatMap((x) => [x.revenue, x.expense]), 1);
  return (
    <div className="flex h-56 items-end gap-3 overflow-x-auto">
      {rows.map((row) => (
        <div
          key={`${row.month}-${row.currency}`}
          className="flex min-w-16 flex-1 flex-col items-center"
        >
          <div className="flex h-44 items-end gap-1">
            <span
              title={`${row.revenue} ${row.currency}`}
              className="w-5 bg-success"
              style={{ height: `${(row.revenue / max) * 100}%` }}
            />
            <span
              title={`${row.expense} ${row.currency}`}
              className="w-5 bg-secondary"
              style={{ height: `${(row.expense / max) * 100}%` }}
            />
          </div>
          <span className="mt-2 text-center text-[10px] text-muted-foreground">
            {new Intl.DateTimeFormat(locale, { month: "short" }).format(
              new Date(`${row.month}T00:00:00Z`),
            )}
            <br />
            {row.currency}
          </span>
        </div>
      ))}
    </div>
  );
}
function LevelDonut({ rows, locale }: { rows: AdminDashboardData["levels"]; locale: AppLocale }) {
  if (!rows.length) return <Empty />;
  const total = rows.reduce((sum, row) => sum + row.students, 0);
  const colors = ["#102b50", "#d3aa45", "#2f855a", "#7c3aed", "#dc6b2f"];
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[12rem_1fr]">
      <svg viewBox="0 0 42 42" className="mx-auto size-44 -rotate-90" role="img">
        {rows.map((row, index) => {
          const value = (row.students / total) * 100;
          const offset = rows
            .slice(0, index)
            .reduce((sum, previous) => sum + (previous.students / total) * 100, 0);
          return (
            <circle
              key={row.name_ar}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="7"
              strokeDasharray={`${value} ${100 - value}`}
              strokeDashoffset={-offset}
            >
              <title>{row.students}</title>
            </circle>
          );
        })}
      </svg>
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={row.name_ar} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <i
                className="size-3 rounded-full"
                style={{ background: colors[index % colors.length] }}
              />
              {locale === "ar" ? row.name_ar : row.name_en}
            </span>
            <b>{row.students}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function TeacherBars({ rows }: { rows: AdminDashboardData["teachers"] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="grid gap-4">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-bold text-primary">{row.name}</span>
            <span>{row.rate == null ? "—" : `${row.rate}%`}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-secondary" style={{ width: `${row.rate ?? 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
function ListCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: string }[];
  empty: string;
}) {
  return (
    <section className="border bg-card p-5 shadow-card">
      <h2 className="text-xl font-black text-primary">{title}</h2>
      <div className="mt-4 divide-y">
        {rows.length ? (
          rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex justify-between gap-4 py-3 text-sm">
              <span>{row.label}</span>
              <b>{row.value}</b>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  );
}
function Filter({
  label,
  name,
  type,
  value,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`dashboard-${name}`}>{label}</Label>
      <Input id={`dashboard-${name}`} name={name} type={type} defaultValue={value} dir="ltr" />
    </div>
  );
}
function Select({
  label,
  name,
  value,
  all,
  options,
}: {
  label: string;
  name: string;
  value: string;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`dashboard-${name}`}>{label}</Label>
      <select
        id={`dashboard-${name}`}
        name={name}
        defaultValue={value}
        className="min-h-11 rounded-lg border bg-background px-3 text-sm"
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function Empty() {
  return <div className="grid h-52 place-items-center text-sm text-muted-foreground">—</div>;
}
function percent(value: number | null, number: Intl.NumberFormat) {
  return value == null ? "—" : `${number.format(value)}%`;
}
function moneyValues(values: { currency: string; amount: number }[], locale: AppLocale) {
  if (!values.length) return "—";
  return values
    .map((row) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: row.currency,
        maximumFractionDigits: 0,
      }).format(row.amount),
    )
    .join(" · ");
}
function dateValue(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}
function codeValue(value: string | string[] | undefined, length: number) {
  return typeof value === "string" && new RegExp(`^[A-Z]{${length}}$`).test(value) ? value : "";
}
