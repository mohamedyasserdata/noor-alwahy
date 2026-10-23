import { ArrowUpLeft, BellRing, Check, CircleDot, Settings2, ShieldCheck, X } from "lucide-react";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  saveInterventionRuleAction,
  transitionInterventionAction,
} from "@/lib/interventions/actions";
import type {
  InterventionCenterData,
  InterventionFilters,
  InterventionRule,
} from "@/lib/interventions/queries";

const ruleTypes = [
  "student_struggle",
  "student_absence",
  "teacher_late",
  "renewal_due",
  "payment_overdue",
  "report_pending",
  "credit_exhausted",
] as const;

export async function InterventionCenter({
  locale,
  data,
  rules,
  filters,
}: {
  locale: AppLocale;
  data: InterventionCenterData;
  rules: InterventionRule[];
  filters: InterventionFilters;
}) {
  const t = await getTranslations({ locale, namespace: "interventionCenter" });
  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <section
      className="mt-8 overflow-hidden border bg-card shadow-card"
      aria-labelledby="intervention-title"
    >
      <header className="grid gap-6 bg-primary p-6 text-primary-foreground sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-black text-secondary">
            <BellRing className="size-4" aria-hidden="true" />
            {t("eyebrow")}
          </p>
          <h2 id="intervention-title" className="mt-3 text-2xl font-black sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-3 leading-7 text-primary-foreground/75">{t("description")}</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-white/15 bg-white/15 sm:grid-cols-4 lg:w-[32rem]">
          {(["open", "acknowledged", "resolved", "dismissed"] as const).map((status) => (
            <div key={status} className="bg-primary px-4 py-3">
              <strong className="block text-2xl font-black text-secondary">
                {data.counts[status]}
              </strong>
              <span className="text-xs text-primary-foreground/70">{t(`statuses.${status}`)}</span>
            </div>
          ))}
        </div>
      </header>

      <form
        className="grid gap-4 border-b p-5 sm:grid-cols-4 sm:items-end"
        aria-label={t("filters.title")}
      >
        <SelectFilter
          label={t("filters.status")}
          name="caseStatus"
          value={filters.status}
          all={t("filters.all")}
          options={(["open", "acknowledged", "resolved", "dismissed"] as const).map((value) => ({
            value,
            label: t(`statuses.${value}`),
          }))}
        />
        <SelectFilter
          label={t("filters.priority")}
          name="casePriority"
          value={filters.priority}
          all={t("filters.all")}
          options={[1, 2, 3, 4, 5].map((value) => ({
            value: String(value),
            label: t("priorityValue", { value }),
          }))}
        />
        <SelectFilter
          label={t("filters.rule")}
          name="caseRule"
          value={filters.ruleType}
          all={t("filters.all")}
          options={ruleTypes.map((value) => ({ value, label: t(`rules.${value}`) }))}
        />
        <Button type="submit" variant="gold">
          {t("filters.apply")}
        </Button>
      </form>

      {data.rows.length ? (
        <ol className="divide-y">
          {data.rows.map((item) => (
            <li
              key={item.id}
              className="relative grid gap-5 p-5 ps-7 sm:p-6 sm:ps-9 lg:grid-cols-[minmax(0,1fr)_17rem]"
            >
              <span
                className={`absolute inset-y-0 start-0 w-1.5 ${priorityColor(item.priority)}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      item.priority >= 4
                        ? "destructive"
                        : item.priority >= 3
                          ? "warning"
                          : "outline"
                    }
                  >
                    {t("priorityValue", { value: item.priority })}
                  </Badge>
                  <Badge variant={item.status === "resolved" ? "success" : "secondary"}>
                    {t(`statuses.${item.status}`)}
                  </Badge>
                  {item.escalated_at ? <Badge variant="destructive">{t("escalated")}</Badge> : null}
                </div>
                <h3 className="mt-3 text-lg font-black text-primary">{item.subject_name}</h3>
                <p className="mt-1 font-bold text-foreground">{t(`reasons.${item.reason_code}`)}</p>
                <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <Meta label={t("firstSeen")} value={formatDate(locale, item.first_detected_at)} />
                  <Meta label={t("lastSeen")} value={formatDate(locale, item.last_detected_at)} />
                  <Meta label={t("detections")} value={String(item.detection_count)} />
                  <Meta label={t("evidence")} value={formatEvidence(item.evidence, locale)} />
                </dl>
                {item.disposition_reason ? (
                  <p className="mt-4 border-s-2 border-secondary ps-3 text-sm text-muted-foreground">
                    {t("disposition")}: {item.disposition_reason}
                  </p>
                ) : null}
              </div>

              <div className="grid content-start gap-3">
                <Button asChild variant="outline">
                  <Link href={item.action_path}>
                    {t(`actions.${item.recommended_action}`)}
                    <ArrowUpLeft aria-hidden="true" />
                  </Link>
                </Button>
                {item.status === "open" ? (
                  <form
                    action={transitionInterventionAction.bind(
                      null,
                      locale,
                      item.id,
                      "acknowledged",
                    )}
                  >
                    <Button type="submit" className="w-full">
                      <CircleDot aria-hidden="true" /> {t("acknowledge")}
                    </Button>
                  </form>
                ) : null}
                {item.status === "open" || item.status === "acknowledged" ? (
                  <details className="border bg-muted/20 p-3 open:bg-card">
                    <summary className="cursor-pointer text-sm font-black text-primary">
                      {t("closeCase")}
                    </summary>
                    <div className="mt-3 grid gap-3">
                      <Label htmlFor={`reason-${item.id}`}>{t("reasonLabel")}</Label>
                      <Input
                        id={`reason-${item.id}`}
                        name="reason"
                        form={`dismiss-${item.id}`}
                        minLength={2}
                        maxLength={500}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <form
                          action={transitionInterventionAction.bind(
                            null,
                            locale,
                            item.id,
                            "resolved",
                          )}
                        >
                          <Button type="submit" size="sm" variant="outline" className="w-full">
                            <Check aria-hidden="true" /> {t("resolve")}
                          </Button>
                        </form>
                        <form
                          id={`dismiss-${item.id}`}
                          action={transitionInterventionAction.bind(
                            null,
                            locale,
                            item.id,
                            "dismissed",
                          )}
                        >
                          <Button type="submit" size="sm" variant="destructive" className="w-full">
                            <X aria-hidden="true" /> {t("dismiss")}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid place-items-center gap-3 px-6 py-14 text-center">
          <ShieldCheck className="size-10 text-success" aria-hidden="true" />
          <p className="font-black text-primary">{t("empty")}</p>
          <p className="max-w-lg text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-4 border-t p-4"
          aria-label={t("pagination")}
        >
          <Button asChild variant="outline" size="sm">
            <Link
              href={pageHref(filters, Math.max(1, data.page - 1))}
              aria-disabled={data.page <= 1}
            >
              {t("previous")}
            </Link>
          </Button>
          <span className="text-sm font-bold">
            {t("page", { page: data.page, total: totalPages })}
          </span>
          <Button asChild variant="outline" size="sm">
            <Link
              href={pageHref(filters, Math.min(totalPages, data.page + 1))}
              aria-disabled={data.page >= totalPages}
            >
              {t("next")}
            </Link>
          </Button>
        </nav>
      ) : null}

      <details className="border-t bg-muted/15">
        <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-5 font-black text-primary sm:px-7">
          <Settings2 className="size-5 text-secondary" aria-hidden="true" />
          {t("settings.title")}
        </summary>
        <div className="grid gap-4 border-t p-5 lg:grid-cols-2 lg:p-7">
          {rules.map((rule) => (
            <RuleForm
              key={rule.id}
              locale={locale}
              rule={rule}
              labels={{
                name: t(`rules.${rule.rule_type}`),
                priority: t("filters.priority"),
                window: t("settings.window"),
                cooldown: t("settings.cooldown"),
                thresholdA: t(`thresholds.${rule.rule_type}.a`),
                thresholdB: hasSecondThreshold(rule.rule_type)
                  ? t(`thresholds.${rule.rule_type}.b`)
                  : "",
                enabled: t("settings.enabled"),
                save: t("settings.save"),
              }}
            />
          ))}
        </div>
      </details>
    </section>
  );
}

type RuleLabels = {
  name: string;
  priority: string;
  window: string;
  cooldown: string;
  thresholdA: string;
  thresholdB: string;
  enabled: string;
  save: string;
};

function RuleForm({
  locale,
  rule,
  labels,
}: {
  locale: AppLocale;
  rule: InterventionRule;
  labels: RuleLabels;
}) {
  const values = thresholdValues(rule);
  return (
    <form
      action={saveInterventionRuleAction.bind(null, locale)}
      className="grid gap-4 border bg-card p-4"
    >
      <input type="hidden" name="ruleId" value={rule.id} />
      <input type="hidden" name="ruleType" value={rule.rule_type} />
      <h3 className="font-black text-primary">{labels.name}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          id={rule.id}
          name="priority"
          label={labels.priority}
          value={rule.priority}
          min={1}
          max={5}
        />
        <NumberField
          id={rule.id}
          name="windowDays"
          label={labels.window}
          value={intervalDays(rule.window_interval)}
          min={1}
          max={365}
        />
        <NumberField
          id={rule.id}
          name="cooldownDays"
          label={labels.cooldown}
          value={intervalDays(rule.cooldown_interval)}
          min={0}
          max={365}
        />
        <NumberField
          id={rule.id}
          name="thresholdA"
          label={labels.thresholdA}
          value={values[0]}
          min={0}
          max={365}
        />
        {labels.thresholdB ? (
          <NumberField
            id={rule.id}
            name="thresholdB"
            label={labels.thresholdB}
            value={values[1]}
            min={1}
            max={120}
          />
        ) : null}
      </div>
      <label className="flex min-h-11 items-center justify-between gap-4 border px-3 text-sm font-bold">
        {labels.enabled}
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={rule.is_enabled}
          className="size-5 accent-primary"
        />
      </label>
      <Button type="submit" variant="outline">
        {labels.save}
      </Button>
    </form>
  );
}

function NumberField({
  id,
  name,
  label,
  value,
  min,
  max,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
}) {
  const inputId = `${id}-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        required
      />
    </div>
  );
}

function SelectFilter({
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
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-foreground">{value}</dd>
    </div>
  );
}

function priorityColor(priority: number) {
  if (priority >= 5) return "bg-destructive";
  if (priority >= 3) return "bg-warning";
  return "bg-secondary";
}

function formatDate(locale: AppLocale, value: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatEvidence(evidence: Record<string, unknown>, locale: AppLocale) {
  return Object.entries(evidence)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(locale === "ar" ? "، " : ", ");
}

function intervalDays(value: string) {
  const match = value.match(/(-?\d+)\s+day/);
  return match ? Math.max(0, Number(match[1])) : 0;
}

function hasSecondThreshold(ruleType: string) {
  return ruleType === "student_struggle" || ruleType === "teacher_late";
}

function thresholdValues(rule: InterventionRule): [number, number] {
  const value = (key: string, fallback: number) =>
    typeof rule.thresholds[key] === "number" ? rule.thresholds[key] : fallback;
  if (rule.rule_type === "student_struggle")
    return [value("max_average", 60), value("min_evaluations", 3)];
  if (rule.rule_type === "student_absence") return [value("min_absences", 3), 1];
  if (rule.rule_type === "teacher_late")
    return [value("min_late_minutes", 10), value("min_occurrences", 2)];
  if (rule.rule_type === "renewal_due") return [value("days_before", 7), 1];
  if (rule.rule_type === "payment_overdue") return [value("days_overdue", 3), 1];
  if (rule.rule_type === "report_pending") return [value("days_pending", 7), 1];
  return [value("max_remaining", 0), 1];
}

function pageHref(filters: InterventionFilters, page: number) {
  const query = new URLSearchParams();
  if (filters.status) query.set("caseStatus", filters.status);
  if (filters.priority) query.set("casePriority", filters.priority);
  if (filters.ruleType) query.set("caseRule", filters.ruleType);
  query.set("casePage", String(page));
  return `/admin/control-center?${query.toString()}` as Route;
}
