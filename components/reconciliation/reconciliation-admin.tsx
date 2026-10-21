import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { runReconciliationAction } from "@/lib/reconciliation/actions";
import { getReconciliationData } from "@/lib/reconciliation/queries";

export async function ReconciliationAdmin({ locale }: { locale: AppLocale }) {
  const [t, data] = await Promise.all([
    getTranslations({ locale, namespace: "reconciliation" }),
    getReconciliationData(),
  ]);
  const latest = data.runs[0];
  const latestIssues = latest ? data.issues.filter((issue) => issue.run_id === latest.id) : [];
  return (
    <section
      className="mt-8 rounded-3xl border bg-card p-5 shadow-card sm:p-7"
      aria-labelledby="reconciliation-title"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h2 id="reconciliation-title" className="mt-2 text-2xl font-black text-primary">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{t("description")}</p>
        </div>
        <form action={runReconciliationAction.bind(null, locale)}>
          <AdminSubmitButton label={t("run")} pendingLabel={t("running")} />
        </form>
      </header>
      {latest ? (
        <div
          className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${latest.status === "passed" ? "bg-success/10" : "bg-destructive/10"}`}
        >
          <div className="flex items-center gap-3">
            {latest.status === "passed" ? (
              <CheckCircle2 className="text-success" aria-hidden="true" />
            ) : (
              <AlertTriangle className="text-destructive" aria-hidden="true" />
            )}
            <div>
              <p className="font-black text-primary">{t(`states.${latest.status}`)}</p>
              <p className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(latest.started_at))}
              </p>
            </div>
          </div>
          <Badge variant={latest.status === "passed" ? "success" : "destructive"}>
            {t("issueCount", { count: latest.issue_count })}
          </Badge>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}
      {latestIssues.length ? (
        <div className="mt-5 grid gap-3">
          {latestIssues.map((issue) => (
            <article
              key={issue.id}
              className="rounded-2xl border border-destructive/25 bg-background p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-primary">{t(`categories.${issue.category}`)}</h3>
                <code className="text-xs text-muted-foreground">{issue.entity_id}</code>
              </div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t("expected")}</dt>
                  <dd className="mt-1 font-bold break-all" dir="auto">
                    {issue.expected}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("actual")}</dt>
                  <dd className="mt-1 font-bold break-all text-destructive" dir="auto">
                    {issue.actual}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : null}
      {data.runs.length > 1 ? (
        <details className="mt-5">
          <summary className="cursor-pointer font-bold text-primary">{t("history")}</summary>
          <ul className="mt-3 grid gap-2">
            {data.runs.slice(1).map((run) => (
              <li
                key={run.id}
                className="flex justify-between rounded-xl bg-background p-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(run.started_at))}
                </span>
                <span>
                  {t(`states.${run.status}`)} · {t("issueCount", { count: run.issue_count })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
