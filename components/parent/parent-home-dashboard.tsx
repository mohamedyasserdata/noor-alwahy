import {
  BellRing,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  UsersRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getNotificationCenter } from "@/lib/notifications/queries";
import { getGuardianPortalContext } from "@/lib/parent/children";
import { getNextSessionCard } from "@/lib/sessions/next-session";

export async function ParentHomeDashboard({ locale }: { locale: AppLocale }) {
  const [t, context, nextSession, notifications] = await Promise.all([
    getTranslations({ locale, namespace: "parentPortal" }),
    getGuardianPortalContext(),
    getNextSessionCard(locale),
    getNotificationCenter(),
  ]);
  const DirectionIcon = locale === "ar" ? ChevronLeft : ChevronRight;
  const importantNotification = notifications?.items.find((item) => !item.readAt) ?? null;

  return (
    <div className="parent-home min-h-svh pb-12 sm:pb-16">
      <section
        className="relative min-h-[24rem] overflow-hidden bg-[url('/images/student/golden-quran-sunlit-mosque.png')] bg-cover bg-[position:38%_62%] lg:min-h-[22rem] lg:bg-[position:center_62%]"
        aria-labelledby="parent-home-title"
      >
        <div
          className="absolute inset-0 bg-linear-to-b from-[#fffaf0]/5 via-[#fffaf0]/58 to-[#fffaf0] lg:bg-linear-to-r lg:from-transparent lg:via-[#fffaf0]/38 lg:to-[#fffaf0]/96 dark:from-[#091a33]/30 dark:via-[#091a33]/78 dark:to-[#091a33] lg:dark:from-[#091a33]/18 lg:dark:via-[#091a33]/68 lg:dark:to-[#091a33]/96"
          aria-hidden="true"
        />
        <div
          className="relative mx-auto grid min-h-[24rem] w-full max-w-[100rem] items-end px-5 pt-14 pb-20 sm:px-8 lg:min-h-[22rem] lg:grid-cols-2 lg:items-center lg:px-12 lg:py-10"
          dir="ltr"
        >
          <span aria-hidden="true" />
          <header
            className="max-w-2xl rounded-3xl bg-[#fffaf0]/76 p-5 backdrop-blur-[2px] sm:p-7 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:bg-[#091a33]/76 lg:dark:bg-transparent"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <p className="text-sm font-black text-[#a96f11] sm:text-base dark:text-secondary">
              {t("welcome", { name: context.guardianName })}
            </p>
            <h1
              id="parent-home-title"
              className="mt-2 text-4xl leading-tight font-black text-balance text-[#101f3b] sm:text-5xl dark:text-primary"
            >
              {t("homeTitle")}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-8 text-[#5d6f86] sm:text-lg dark:text-muted-foreground">
              {t("homeDescription")}
            </p>
          </header>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-14 grid w-full max-w-[100rem] gap-5 px-4 sm:px-6 lg:px-10">
        <section
          className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
          aria-labelledby="parent-children-summary-title"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-[#f7ecd4] text-[#a96f11] dark:bg-accent dark:text-secondary">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <h2 id="parent-children-summary-title" className="text-2xl font-black text-primary">
              {t("children.title")}
            </h2>
          </div>

          {context.children.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {context.children.map((child) => {
                const track = locale === "ar" ? child.trackAr : child.trackEn;
                const level = locale === "ar" ? child.levelAr : child.levelEn;
                return (
                  <article
                    key={child.id}
                    className="rounded-2xl border border-secondary/20 bg-background/70 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#edf4ff] text-[#245fa8] dark:bg-accent">
                        <CircleUserRound className="size-7" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-black break-words text-primary">
                          {child.name}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {[track, level].filter(Boolean).join(" · ") || t("children.noPlacement")}
                        </p>
                      </div>
                    </div>
                    {child.progressPercent == null ? (
                      <p className="mt-5 text-sm text-muted-foreground">
                        {t("children.noProgress")}
                      </p>
                    ) : (
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="font-bold text-primary">{t("children.progress")}</span>
                          <strong className="text-primary tabular-nums">
                            {child.progressPercent}%
                          </strong>
                        </div>
                        <Progress
                          value={child.progressPercent}
                          aria-label={t("children.progress")}
                        />
                      </div>
                    )}
                    <Button asChild variant="outline" className="mt-5 w-full border-secondary/40">
                      <Link href={{ pathname: "/parent/children", query: { student: child.id } }}>
                        {t("children.openProfile")}
                        <DirectionIcon aria-hidden="true" />
                      </Link>
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState text={t("children.empty")} />
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <NextSessionSummary
            session={nextSession.session}
            fallbackTeacherName={
              context.children.find((child) => child.name === nextSession.session?.studentName)
                ?.teacherName
            }
            t={t}
          />
          <section
            className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
            aria-labelledby="important-alert-title"
          >
            <h2
              id="important-alert-title"
              className="flex items-center gap-2 text-xl font-black text-primary"
            >
              <BellRing className="size-5 text-secondary" aria-hidden="true" />
              {t("alerts.title")}
            </h2>
            {importantNotification ? (
              <div className="mt-5 rounded-2xl bg-[#fff8e9] p-5 dark:bg-accent/35">
                <p className="font-black text-primary">
                  {locale === "ar"
                    ? (importantNotification.payload.titleAr ?? t("alerts.fallbackTitle"))
                    : (importantNotification.payload.titleEn ?? t("alerts.fallbackTitle"))}
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {locale === "ar"
                    ? (importantNotification.payload.bodyAr ?? t("alerts.followUp"))
                    : (importantNotification.payload.bodyEn ?? t("alerts.followUp"))}
                </p>
              </div>
            ) : (
              <EmptyState text={t("alerts.empty")} compact />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;
type Session = Awaited<ReturnType<typeof getNextSessionCard>>["session"];

function NextSessionSummary({
  fallbackTeacherName,
  session,
  t,
}: {
  fallbackTeacherName?: string | null;
  session: Session;
  t: Translator;
}) {
  return (
    <section
      className="rounded-[1.75rem] border border-secondary/20 bg-card/96 p-5 shadow-card sm:p-7"
      aria-labelledby="parent-next-session-title"
    >
      <h2
        id="parent-next-session-title"
        className="flex items-center gap-2 text-xl font-black text-primary"
      >
        <CalendarClock className="size-5 text-secondary" aria-hidden="true" />
        {t("nextSession.title")}
      </h2>
      {session ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <SummaryValue label={t("nextSession.child")} value={session.studentName} />
            <SummaryValue
              label={t("nextSession.teacher")}
              value={session.teacherName ?? fallbackTeacherName ?? null}
            />
            <SummaryValue label={t("nextSession.date")} value={session.dateLabel} />
            <SummaryValue label={t("nextSession.time")} value={session.timeLabel} dir="ltr" />
          </dl>
          <Button asChild variant="outline" className="border-secondary/40">
            <Link href="/parent/schedule">{t("nextSession.openSchedule")}</Link>
          </Button>
        </div>
      ) : (
        <EmptyState text={t("nextSession.empty")} compact />
      )}
      {session ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {t("timezone", { timezone: session.timezone })}
        </p>
      ) : null}
    </section>
  );
}

function SummaryValue({ dir, label, value }: { dir?: "ltr"; label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black text-primary" dir={dir}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function EmptyState({ compact = false, text }: { compact?: boolean; text: string }) {
  return (
    <div
      className={`mt-5 rounded-2xl border border-dashed border-secondary/35 bg-[#fffaf0]/60 text-center text-sm leading-7 text-muted-foreground dark:bg-accent/20 ${compact ? "p-5" : "p-8"}`}
    >
      {text}
    </div>
  );
}
