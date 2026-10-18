import { AlertTriangle, Filter, LockKeyhole, ScrollText } from "lucide-react";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  auditActions,
  getAuditFieldChanges,
  parseAuditLogFilters,
  type AuditAction,
  type AuditFieldChange,
  type AuditLogFilters,
  type AuditLogRow,
} from "@/lib/audit/audit-log";
import { auditLogPageSize, getAuditLogs } from "@/lib/audit/get-audit-logs";
import type { AppLocale } from "@/i18n/routing";

type AuditLogSectionProps = {
  locale: AppLocale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AuditTranslations = Awaited<ReturnType<typeof getTranslations>>;

export async function AuditLogSection({ locale, searchParams }: AuditLogSectionProps) {
  const [portalT, auditT] = await Promise.all([
    getTranslations({ locale, namespace: "portals.admin.sections.audit" }),
    getTranslations({ locale, namespace: "auditLog" }),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl" aria-labelledby="portal-page-title">
      <header className="max-w-3xl">
        <p className="mb-3 inline-flex min-h-8 items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 text-xs font-extrabold tracking-wide text-primary">
          {auditT("eyebrow")}
        </p>
        <h1
          id="portal-page-title"
          className="text-3xl font-black tracking-tight text-balance text-primary sm:text-4xl lg:text-5xl"
        >
          {portalT("title")}
        </h1>
        <p className="mt-4 text-base leading-8 text-pretty text-muted-foreground sm:text-lg">
          {portalT("description")}
        </p>
      </header>

      <Suspense fallback={<AuditLogLoading label={auditT("loading")} />}>
        <AuditLogResults locale={locale} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function AuditLogResults({ locale, searchParams }: AuditLogSectionProps) {
  const params = await searchParams;
  const filters = parseAuditLogFilters(params);
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "auditLog" }),
    getAuditLogs(filters),
  ]);

  if (result.status === "forbidden") {
    return (
      <AuditLogNotice
        icon={<LockKeyhole className="size-6" aria-hidden="true" />}
        title={t("forbidden.title")}
        description={t("forbidden.description")}
      />
    );
  }

  if (result.status === "error") {
    return (
      <AuditLogNotice
        icon={<AlertTriangle className="size-6" aria-hidden="true" />}
        title={t("error.title")}
        description={t("error.description")}
        tone="danger"
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(result.count / auditLogPageSize));

  return (
    <div className="mt-9 grid gap-6">
      <AuditLogFilters filters={filters} locale={locale} t={t} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <p className="text-sm font-bold text-muted-foreground tabular-nums" role="status">
          {t("resultsCount", { count: result.count })}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("pagination.page", { page: filters.page })}
        </p>
      </div>

      {result.entries.length === 0 ? (
        <AuditLogNotice
          icon={<ScrollText className="size-6" aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <>
          <AuditLogCards actors={result.actors} entries={result.entries} locale={locale} t={t} />
          <AuditLogTable actors={result.actors} entries={result.entries} locale={locale} t={t} />
        </>
      )}

      {pageCount > 1 ? (
        <AuditPagination filters={filters} locale={locale} pageCount={pageCount} t={t} />
      ) : null}
    </div>
  );
}

function AuditLogFilters({
  filters,
  locale,
  t,
}: {
  filters: AuditLogFilters;
  locale: AppLocale;
  t: AuditTranslations;
}) {
  return (
    <form
      action={`/${locale}/admin/audit`}
      className="rounded-2xl border bg-card p-5 shadow-card sm:p-6"
      data-testid="audit-log-filters"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-secondary">
          <Filter className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-black text-primary">{t("filters.title")}</h2>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-foreground" htmlFor="audit-action">
          {t("filters.action")}
          <select
            id="audit-action"
            name="action"
            defaultValue={filters.action ?? ""}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("filters.allActions")}</option>
            {auditActions.map((action) => (
              <option key={action} value={action}>
                {t(`actions.${action}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-foreground" htmlFor="audit-table">
          {t("filters.table")}
          <Input
            id="audit-table"
            name="table"
            defaultValue={filters.tableName}
            placeholder={t("filters.tablePlaceholder")}
            dir="ltr"
            maxLength={63}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-foreground" htmlFor="audit-record">
          {t("filters.record")}
          <Input
            id="audit-record"
            name="record"
            defaultValue={filters.recordId}
            placeholder={t("filters.recordPlaceholder")}
            dir="ltr"
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          {t("filters.apply")}
        </button>
        <Link
          href={`/${locale}/admin/audit`}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-lg border bg-background px-5 text-sm font-extrabold text-primary transition-colors outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          {t("filters.clear")}
        </Link>
      </div>
    </form>
  );
}

function AuditLogCards({
  actors,
  entries,
  locale,
  t,
}: {
  actors: Record<string, string>;
  entries: AuditLogRow[];
  locale: AppLocale;
  t: AuditTranslations;
}) {
  return (
    <div className="relative lg:hidden">
      <span className="inset-block-3 absolute start-1.5 w-px bg-secondary/45" aria-hidden="true" />
      <ol className="grid gap-4 ps-6">
        {entries.map((entry) => (
          <li key={entry.id} className="relative rounded-2xl border bg-card p-5 shadow-card">
            <span
              className="absolute start-[-1.55rem] top-7 size-3 rounded-full border-2 border-background bg-secondary"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant={actionVariant(entry.action)}>{actionLabel(t, entry.action)}</Badge>
                <p className="mt-3 font-black text-primary">
                  <bdi>{entry.table_name ?? t("unknownRecord")}</bdi>
                </p>
                <p
                  className="mt-1 text-xs break-all text-muted-foreground tabular-nums"
                  dir="ltr"
                  translate="no"
                >
                  {entry.record_id ?? t("unknownRecord")}
                </p>
              </div>
              <time
                dateTime={entry.created_at}
                className="text-xs leading-6 text-muted-foreground tabular-nums"
              >
                {formatAuditTime(locale, entry.created_at)}
              </time>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {actorLabel(t, actors, entry.user_id)}
            </p>
            <AuditChanges entry={entry} t={t} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function AuditLogTable({
  actors,
  entries,
  locale,
  t,
}: {
  actors: Record<string, string>;
  entries: AuditLogRow[];
  locale: AppLocale;
  t: AuditTranslations;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-card lg:block">
      <table className="w-full border-collapse text-start text-sm">
        <thead className="border-b bg-muted/60 text-primary">
          <tr>
            <th scope="col" className="px-5 py-4 text-start font-black">
              {t("columns.time")}
            </th>
            <th scope="col" className="px-5 py-4 text-start font-black">
              {t("columns.actor")}
            </th>
            <th scope="col" className="px-5 py-4 text-start font-black">
              {t("columns.event")}
            </th>
            <th scope="col" className="px-5 py-4 text-start font-black">
              {t("columns.changes")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((entry) => (
            <tr key={entry.id} className="align-top">
              <td className="px-5 py-5 whitespace-nowrap text-muted-foreground tabular-nums">
                <time dateTime={entry.created_at}>{formatAuditTime(locale, entry.created_at)}</time>
              </td>
              <td className="px-5 py-5 font-bold text-primary">
                {actorLabel(t, actors, entry.user_id)}
              </td>
              <td className="px-5 py-5">
                <Badge variant={actionVariant(entry.action)}>{actionLabel(t, entry.action)}</Badge>
                <p className="mt-2 font-bold text-primary">
                  <bdi>{entry.table_name ?? t("unknownRecord")}</bdi>
                </p>
                <p
                  className="mt-1 max-w-56 truncate text-xs text-muted-foreground tabular-nums"
                  dir="ltr"
                  translate="no"
                >
                  {entry.record_id ?? t("unknownRecord")}
                </p>
              </td>
              <td className="min-w-72 px-5 py-5">
                <AuditChanges entry={entry} t={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditChanges({ entry, t }: { entry: AuditLogRow; t: AuditTranslations }) {
  const changes = getAuditFieldChanges(entry.before, entry.after);

  return (
    <details className="mt-4 rounded-xl border bg-background px-4 open:pb-4">
      <summary className="flex min-h-11 cursor-pointer touch-manipulation items-center font-bold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {t("changes", { count: changes.length })}
      </summary>
      <div className="grid gap-3">
        {changes.map((change) => (
          <AuditChange key={change.field} change={change} t={t} />
        ))}
      </div>
    </details>
  );
}

function AuditChange({ change, t }: { change: AuditFieldChange; t: AuditTranslations }) {
  return (
    <div className="grid gap-2 border-s-2 border-secondary/55 ps-3">
      <p className="text-sm font-black text-primary">{fieldLabel(t, change.field)}</p>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-bold text-muted-foreground">{t("before")}</dt>
          <dd className="mt-1 break-words" dir="auto">
            {formatAuditValue(t, change.before)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-muted-foreground">{t("after")}</dt>
          <dd className="mt-1 break-words" dir="auto">
            {formatAuditValue(t, change.after)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AuditPagination({
  filters,
  locale,
  pageCount,
  t,
}: {
  filters: AuditLogFilters;
  locale: AppLocale;
  pageCount: number;
  t: AuditTranslations;
}) {
  return (
    <nav
      className="flex items-center justify-between gap-4"
      aria-label={t("pagination.page", { page: filters.page })}
    >
      {filters.page > 1 ? (
        <Link
          className="inline-flex min-h-11 touch-manipulation items-center font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          href={auditPageHref(locale, filters, filters.page - 1)}
        >
          {t("pagination.previous")}
        </Link>
      ) : (
        <span />
      )}
      {filters.page < pageCount ? (
        <Link
          className="inline-flex min-h-11 touch-manipulation items-center font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          href={auditPageHref(locale, filters, filters.page + 1)}
        >
          {t("pagination.next")}
        </Link>
      ) : null}
    </nav>
  );
}

function AuditLogNotice({
  description,
  icon,
  title,
  tone = "default",
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
  tone?: "danger" | "default";
}) {
  return (
    <div
      className="mt-9 max-w-3xl rounded-2xl border bg-card p-6 shadow-card sm:p-8"
      role={tone === "danger" ? "alert" : "status"}
    >
      <span
        className={
          tone === "danger"
            ? "grid size-12 place-items-center rounded-2xl bg-destructive/12 text-destructive"
            : "grid size-12 place-items-center rounded-2xl bg-primary text-secondary"
        }
      >
        {icon}
      </span>
      <h2 className="mt-6 text-xl font-black text-primary">{title}</h2>
      <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function AuditLogLoading({ label }: { label: string }) {
  return (
    <div className="mt-9 rounded-2xl border bg-card p-6 shadow-card" role="status">
      <p className="font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function actionLabel(t: AuditTranslations, action: string) {
  return auditActions.includes(action as AuditAction)
    ? t(`actions.${action as AuditAction}`)
    : action;
}

function actionVariant(action: string): "destructive" | "secondary" | "warning" {
  if (action === "DELETE") return "destructive";
  if (action === "INSERT") return "secondary";
  return "warning";
}

function actorLabel(t: AuditTranslations, actors: Record<string, string>, userId: string | null) {
  if (!userId) return t("systemActor");
  return actors[userId] ?? userId;
}

function fieldLabel(t: AuditTranslations, field: string) {
  if (field === "role") return t("fields.role");
  if (field === "is_active") return t("fields.is_active");
  return field.replaceAll("_", " ");
}

function formatAuditValue(
  t: AuditTranslations,
  value: AuditFieldChange["before"] | AuditFieldChange["after"],
) {
  if (value === undefined || value === null || value === "") return t("values.empty");
  if (value === true) return t("values.true");
  if (value === false) return t("values.false");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatAuditTime(locale: AppLocale, value: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(new Date(value));
}

function auditPageHref(locale: AppLocale, filters: AuditLogFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.tableName) params.set("table", filters.tableName);
  if (filters.recordId) params.set("record", filters.recordId);
  params.set("page", String(page));
  return `/${locale}/admin/audit?${params.toString()}` as Route;
}
