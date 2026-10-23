import { BookOpenCheck, CheckCircle2, Clock3 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SessionEvaluationForm } from "@/components/evaluation/session-evaluation-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getEvaluationFormData } from "@/lib/evaluation/form-data";

type Query = Promise<Record<string, string | string[] | undefined>>;

const errorCodes = [
  "invalid_fields",
  "ayah_not_found",
  "ayah_order",
  "evaluation_locked",
  "criteria_invalid",
  "request_failed",
] as const;

export async function SessionEvaluationsSection({
  locale,
  searchParams,
}: {
  locale: AppLocale;
  searchParams: Query;
}) {
  const [t, data, query] = await Promise.all([
    getTranslations({ locale, namespace: "sessionEvaluation" }),
    getEvaluationFormData(),
    searchParams,
  ]);
  const requestedSession = typeof query.sessionId === "string" ? query.sessionId : "";
  const selected =
    data.sessions.find(
      (session) => session.id === requestedSession && !session.evaluation?.is_locked,
    ) ?? data.sessions.find((session) => !session.evaluation?.is_locked);
  const saved = query.evaluationStatus === "saved";
  const requestedError = typeof query.evaluationError === "string" ? query.evaluationError : "";
  const error = errorCodes.includes(requestedError as (typeof errorCodes)[number])
    ? requestedError
    : requestedError
      ? "request_failed"
      : "";
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section
      className="mx-auto w-full max-w-6xl overflow-x-hidden"
      aria-labelledby="session-evaluation-title"
    >
      <header className="grid gap-5 border-b border-secondary/30 pb-7 lg:grid-cols-[1fr_17rem] lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-black text-secondary">{t("eyebrow")}</p>
          <h1
            id="session-evaluation-title"
            className="text-3xl font-black text-balance text-primary sm:text-4xl"
          >
            {t("title")}
          </h1>
          <p className="mt-4 leading-8 text-muted-foreground">{t("description")}</p>
        </div>
        <div className="border-s-4 border-secondary bg-primary p-5 text-primary-foreground">
          <Clock3 className="size-5 text-secondary" aria-hidden="true" />
          <p className="mt-3 font-black">{t("goal")}</p>
          <p className="mt-1 text-sm text-primary-foreground/75">{t("goalDescription")}</p>
        </div>
      </header>

      {saved ? (
        <Alert variant="success" className="mt-6" aria-live="polite">
          {t("saved", { score: String(query.score ?? "—"), rating: String(query.rating ?? "—") })}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="warning" className="mt-6" aria-live="polite">
          {t(`errors.${error}`)}
        </Alert>
      ) : null}

      <div className="mt-7 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <h2 className="font-black text-primary">{t("sessionsTitle")}</h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {data.sessions.map((session) => (
              <Link
                key={session.id}
                href={`/teacher/evaluations?sessionId=${session.id}`}
                aria-current={selected?.id === session.id ? "page" : undefined}
                className={`min-w-64 rounded-xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-w-0 ${selected?.id === session.id ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
              >
                <span className="block font-black">{session.studentName}</span>
                <span
                  className={`mt-1 block text-xs ${selected?.id === session.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {formatter.format(new Date(session.scheduledAt))}
                </span>
                {session.evaluation?.is_locked ? (
                  <Badge className="mt-3" variant="success">
                    <CheckCircle2 aria-hidden="true" />
                    {t("locked")}
                  </Badge>
                ) : null}
              </Link>
            ))}
          </div>
        </aside>

        <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-card sm:p-7">
          {!selected ? (
            <div className="py-12 text-center">
              <BookOpenCheck className="mx-auto size-10 text-secondary" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black text-primary">{t("emptyTitle")}</h2>
              <p className="mt-2 text-muted-foreground">{t("emptyDescription")}</p>
            </div>
          ) : (
            <>
              <div className="mb-7 border-b pb-5">
                <p className="text-sm font-bold text-primary">{t("evaluating")}</p>
                <h2 className="mt-1 text-2xl font-black text-primary">{selected.studentName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatter.format(new Date(selected.scheduledAt))}
                </p>
              </div>
              <SessionEvaluationForm
                key={selected.id}
                locale={locale}
                sessionId={selected.id}
                settings={data.settings}
                surahs={data.surahs}
                clearSavedDraft={saved}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
