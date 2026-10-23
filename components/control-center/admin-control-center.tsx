import {
  AlertTriangle,
  ArrowUpLeft,
  BookOpenCheck,
  Clock3,
  Landmark,
  SlidersHorizontal,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InterventionCenter } from "@/components/control-center/intervention-center";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  getAdminControlCenter,
  type AdminMetric,
  type FinanceMetrics,
  type MetricSourceState,
} from "@/lib/control-center/admin-metrics";
import { getInterventionCenter, parseInterventionFilters } from "@/lib/interventions/queries";

type Query = Promise<Record<string, string | string[] | undefined>>;

export async function AdminControlCenter({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const query = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(today.getUTCDate() - 29);
  const filters = {
    from: dateValue(query.from, defaultFrom.toISOString().slice(0, 10)),
    to: dateValue(query.to, today.toISOString().slice(0, 10)),
    country: codeValue(query.country, 2),
    track: uuidValue(query.track),
    teacher: uuidValue(query.teacher),
    status: statusValue(query.status),
    timezone: timezoneValue(query.timezone),
  };
  const interventionFilters = parseInterventionFilters(query);
  const [t, center, interventions] = await Promise.all([
    getTranslations({ locale, namespace: "adminControlCenter" }),
    getAdminControlCenter(filters),
    getInterventionCenter(interventionFilters),
  ]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const selectedQuery = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="control-center-title">
      <header className="overflow-hidden border bg-primary text-primary-foreground shadow-card">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
            <h1
              id="control-center-title"
              className="mt-3 max-w-3xl text-3xl font-black sm:text-4xl"
            >
              {t("title")}
            </h1>
            <p className="mt-4 max-w-3xl leading-8 text-primary-foreground/75">
              {t("description")}
            </p>
          </div>
          <div className="border-s-2 border-secondary ps-5">
            <p className="text-sm text-primary-foreground/65">{t("periodLabel")}</p>
            <p className="mt-2 text-xl font-black" dir="ltr">
              {filters.from} — {filters.to}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-primary-foreground/70">
              <Clock3 className="size-4 text-secondary" aria-hidden="true" />
              {filters.timezone}
            </p>
          </div>
        </div>
      </header>

      <form className="mt-6 border bg-card p-5 shadow-card" aria-label={t("filters.title")}>
        <div className="mb-4 flex items-center gap-2 text-primary">
          <SlidersHorizontal className="size-5 text-secondary" aria-hidden="true" />
          <h2 className="font-black">{t("filters.title")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label={t("filters.from")} name="from" type="date" value={filters.from} />
          <Filter label={t("filters.to")} name="to" type="date" value={filters.to} />
          <Select
            label={t("filters.country")}
            name="country"
            value={filters.country}
            all={t("filters.all")}
            options={center.options.countries.map((value) => ({ value, label: value }))}
          />
          <Select
            label={t("filters.track")}
            name="track"
            value={filters.track}
            all={t("filters.all")}
            options={center.options.tracks.map((track) => ({
              value: track.id,
              label: locale === "ar" || !track.name_en ? track.name_ar : track.name_en,
            }))}
          />
          <Select
            label={t("filters.teacher")}
            name="teacher"
            value={filters.teacher}
            all={t("filters.all")}
            options={center.options.teachers.map((teacher) => ({
              value: teacher.id,
              label: teacher.name,
            }))}
          />
          <Select
            label={t("filters.status")}
            name="status"
            value={filters.status}
            all={t("filters.all")}
            options={center.options.statuses.map((value) => ({
              value,
              label: t(`statuses.${value}`),
            }))}
          />
          <Filter
            label={t("filters.timezone")}
            name="timezone"
            type="text"
            value={filters.timezone}
          />
          <div className="flex items-end">
            <Button type="submit" variant="gold" className="w-full">
              {t("filters.apply")}
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-7 grid gap-7">
        <SourceSection
          state={center.operations}
          locale={locale}
          title={t("sources.operations.title")}
          description={t("sources.operations.description")}
          icon={<Clock3 />}
          unavailable={t("unavailable")}
        >
          {(data) => (
            <MetricLedger
              locale={locale}
              number={number}
              metrics={data.metrics}
              entries={[
                ["students", "/admin/students"],
                ["teachers", "/admin/teachers"],
                ["sessions", "/admin/schedule"],
                ["held_sessions", "/admin/schedule"],
                ["missed_sessions", "/admin/attendance"],
                ["cancelled_sessions", "/admin/attendance"],
                ["attendance_rate", "/admin/attendance"],
                ["active_subscriptions", "/admin/subscriptions"],
              ]}
              labels={(key) => t(`metrics.${key}`)}
              definitions={(key) => t(`definitions.${key}`)}
              periods={{ snapshot: t("periods.snapshot"), range: t("periods.range") }}
              query={selectedQuery}
            />
          )}
        </SourceSection>

        <SourceSection
          state={center.learning}
          locale={locale}
          title={t("sources.learning.title")}
          description={t("sources.learning.description")}
          icon={<BookOpenCheck />}
          unavailable={t("unavailable")}
        >
          {(data) => (
            <MetricLedger
              locale={locale}
              number={number}
              metrics={data.metrics}
              entries={[
                ["mastered_pages", "/admin/students"],
                ["due_reviews", "/admin/students"],
                ["evaluation_average", "/admin/evaluation"],
                ["locked_evaluations", "/admin/evaluation"],
                ["visible_reports", "/admin/reports"],
                ["pending_reports", "/admin/reports"],
              ]}
              labels={(key) => t(`metrics.${key}`)}
              definitions={(key) => t(`definitions.${key}`)}
              periods={{ snapshot: t("periods.snapshot"), range: t("periods.range") }}
              query={selectedQuery}
            />
          )}
        </SourceSection>

        <SourceSection
          state={center.finance}
          locale={locale}
          title={t("sources.finance.title")}
          description={t("sources.finance.description")}
          icon={<Landmark />}
          unavailable={t("unavailable")}
        >
          {(data) => (
            <FinanceLedger
              data={data}
              locale={locale}
              empty={t("finance.empty")}
              labels={{
                currency: t("finance.currency"),
                invoiced: t("finance.invoiced"),
                overdue: t("finance.overdue"),
                payments: t("finance.payments"),
                payouts: t("finance.payouts"),
                payoutsDue: t("finance.payoutsDue"),
              }}
            />
          )}
        </SourceSection>
      </div>

      <InterventionCenter
        locale={locale}
        data={interventions.center}
        rules={interventions.rules}
        filters={interventionFilters}
      />
    </section>
  );
}

function SourceSection<T extends { refreshed_at: string }>({
  state,
  locale,
  title,
  description,
  icon,
  unavailable,
  children,
}: {
  state: MetricSourceState<T>;
  locale: AppLocale;
  title: string;
  description: string;
  icon: React.ReactNode;
  unavailable: string;
  children: (data: T) => React.ReactNode;
}) {
  return (
    <section className="border bg-card shadow-card">
      <header className="grid gap-4 border-b p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-secondary [&>svg]:size-5">
            {icon}
          </span>
          <div>
            <h2 className="text-xl font-black text-primary">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {state.available ? (
          <Badge variant="secondary">
            {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
              new Date(state.data.refreshed_at),
            )}
          </Badge>
        ) : null}
      </header>
      {state.available ? (
        children(state.data)
      ) : (
        <div className="flex items-start gap-3 p-6 text-destructive sm:p-8" role="status">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p className="font-bold">{unavailable}</p>
        </div>
      )}
    </section>
  );
}

function MetricLedger({
  locale,
  number,
  metrics,
  entries,
  labels,
  definitions,
  periods,
  query,
}: {
  locale: AppLocale;
  number: Intl.NumberFormat;
  metrics: Record<string, AdminMetric>;
  entries: [string, string][];
  labels: (key: string) => string;
  definitions: (key: string) => string;
  periods: { snapshot: string; range: string };
  query: URLSearchParams;
}) {
  return (
    <div className="divide-y">
      {entries.map(([key, path], index) => {
        const metric = metrics[key];
        if (!metric) return null;
        return (
          <a
            key={key}
            href={`/${locale}${path}?${query.toString()}`}
            className="group grid gap-3 p-5 outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center sm:p-6"
          >
            <span className="text-sm font-black text-secondary" dir="ltr">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <b className="block text-primary">{labels(key)}</b>
              <small className="mt-1 block leading-5 text-muted-foreground">
                {definitions(key)}
              </small>
              <small className="mt-1 block text-muted-foreground">
                {periods[metric.period]} · n={number.format(metric.denominator)}
              </small>
            </span>
            <span className="flex items-center justify-between gap-4 sm:justify-end">
              <strong className="text-2xl font-black text-primary" dir="auto">
                {metric.value == null
                  ? "—"
                  : `${number.format(metric.value)}${metric.unit === "percent" ? "%" : ""}`}
              </strong>
              <ArrowUpLeft
                className="size-4 text-secondary transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </span>
          </a>
        );
      })}
    </div>
  );
}

function FinanceLedger({
  data,
  locale,
  empty,
  labels,
}: {
  data: FinanceMetrics;
  locale: AppLocale;
  empty: string;
  labels: Record<
    "currency" | "invoiced" | "overdue" | "payments" | "payouts" | "payoutsDue",
    string
  >;
}) {
  if (!data.currencies.length)
    return <p className="p-8 text-center text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-4xl border-collapse text-sm">
        <thead>
          <tr className="bg-muted/45">
            {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
              <th key={key} className="border-b p-4 text-start font-black text-primary">
                {labels[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.currencies.map((row) => (
            <tr key={row.currency} className="border-b last:border-0">
              <td className="p-4 font-black" dir="ltr">
                {row.currency}
              </td>
              <Money
                value={row.invoiced}
                currency={row.currency}
                locale={locale}
                detail={row.invoice_count}
              />
              <Money value={row.overdue} currency={row.currency} locale={locale} />
              <Money
                value={row.payments_net}
                currency={row.currency}
                locale={locale}
                detail={row.payment_count}
              />
              <Money
                value={row.payouts_total}
                currency={row.currency}
                locale={locale}
                detail={row.payout_count}
              />
              <Money value={row.payouts_due} currency={row.currency} locale={locale} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Money({
  value,
  currency,
  locale,
  detail,
}: {
  value: number;
  currency: string;
  locale: AppLocale;
  detail?: number;
}) {
  return (
    <td className="p-4">
      <b dir="ltr">
        {new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(value)}
      </b>
      {detail == null ? null : (
        <small className="mt-1 block text-muted-foreground">n={detail}</small>
      )}
    </td>
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
      <Label htmlFor={`control-${name}`}>{label}</Label>
      <Input id={`control-${name}`} name={name} type={type} defaultValue={value} dir="ltr" />
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
      <Label htmlFor={`control-${name}`}>{label}</Label>
      <select
        id={`control-${name}`}
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

function dateValue(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}
function codeValue(value: string | string[] | undefined, length: number) {
  return typeof value === "string" && new RegExp(`^[A-Z]{${length}}$`).test(value) ? value : "";
}
function uuidValue(value: string | string[] | undefined) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : "";
}
function statusValue(value: string | string[] | undefined) {
  return typeof value === "string" &&
    ["active", "dropped", "graduated", "suspended", "archived"].includes(value)
    ? value
    : "";
}
function timezoneValue(value: string | string[] | undefined) {
  return typeof value === "string" && /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value)
    ? value.slice(0, 100)
    : "Africa/Cairo";
}
