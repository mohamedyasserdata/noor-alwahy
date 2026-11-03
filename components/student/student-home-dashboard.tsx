import {
  BellRing,
  BookOpenCheck,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListChecks,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { NextSessionCard } from "@/components/sessions/next-session-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getStudentMemorizationPlan } from "@/lib/memorization-plans/queries";
import { getNotificationCenter } from "@/lib/notifications/queries";
import { getStudentProgressDashboard } from "@/lib/progress/dashboard";
import { getNextSessionCard } from "@/lib/sessions/next-session";

export async function StudentHomeDashboard({ locale }: { locale: AppLocale }) {
  const [t, nextSessionTranslations, sessionData, progressData, plan, notificationCenter] =
    await Promise.all([
      getTranslations({ locale, namespace: "studentHome" }),
      getTranslations({ locale, namespace: "nextSession" }),
      getNextSessionCard(locale),
      getStudentProgressDashboard(),
      getStudentMemorizationPlan(),
      getNotificationCenter(),
    ]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const priorityNotification = notificationCenter?.items.find((item) => !item.readAt) ?? null;
  const notificationTitle = priorityNotification
    ? locale === "ar"
      ? priorityNotification.payload.titleAr
      : priorityNotification.payload.titleEn
    : null;
  const notificationBody = priorityNotification
    ? locale === "ar"
      ? priorityNotification.payload.bodyAr
      : priorityNotification.payload.bodyEn
    : null;
  const attendance = progressData.metrics.attendanceRate;
  const weeklyPlan = Number(plan?.weekly_adherence_percent ?? 0);
  const DirectionIcon = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div className="student-home min-h-svh pb-10 sm:pb-14">
      <section
        className="relative min-h-[16rem] overflow-hidden bg-[url('/images/student/golden-quran-sunlit-mosque.png')] bg-cover bg-[position:34%_62%] sm:min-h-[18rem] lg:bg-[position:center_62%]"
        aria-labelledby="student-home-title"
      >
        <div
          className="absolute inset-0 bg-linear-to-b from-[#fffaf0]/30 via-[#fffaf0]/75 to-[#fffaf0] lg:bg-linear-to-r lg:from-[#fffaf0]/12 lg:via-[#fffaf0]/48 lg:to-[#fffaf0]/98 dark:from-[#091a33]/45 dark:via-[#091a33]/82 dark:to-[#091a33]"
          aria-hidden="true"
        />
        <div
          className="relative mx-auto grid min-h-[16rem] w-full max-w-[100rem] items-end px-5 pt-8 pb-14 sm:min-h-[18rem] sm:px-8 sm:pb-16 lg:grid-cols-2 lg:items-center lg:px-12 lg:py-8"
          dir="ltr"
        >
          <span aria-hidden="true" />
          <header
            className="max-w-2xl rounded-2xl bg-[#fffaf0]/82 p-4 backdrop-blur-[2px] sm:p-5 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:bg-[#091a33]/82 lg:dark:bg-transparent"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <p className="text-sm font-black text-[#9a6512]">
              {t("welcome", { name: progressData.student.name })}
            </p>
            <h1
              id="student-home-title"
              className="mt-1.5 text-3xl leading-tight font-black text-balance text-[#0b2b57] sm:text-4xl dark:text-primary"
            >
              {nextSessionTranslations("title")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#5d6f86] sm:text-base dark:text-muted-foreground">
              {t("description")}
            </p>
          </header>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-8 w-full max-w-[100rem] px-4 sm:-mt-10 sm:px-6 lg:px-10">
        <NextSessionCard
          appearance="student-home"
          serverNowMs={sessionData.serverNowMs}
          session={sessionData.session}
        />

        {priorityNotification ? (
          <section className="mt-4 flex items-start gap-3 rounded-2xl border border-secondary/30 bg-[#fff8e8] p-4 dark:bg-accent/35">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary/18 text-[#8a5b0f] dark:text-secondary">
              <BellRing className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#8a5b0f] dark:text-secondary">
                {t("importantAlert")}
              </p>
              <h2 className="mt-1 font-black text-primary">
                {notificationTitle || t("notificationFallback")}
              </h2>
              {notificationBody ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{notificationBody}</p>
              ) : null}
            </div>
            {priorityNotification.payload.href ? (
              <a
                href={priorityNotification.payload.href}
                className="grid size-11 shrink-0 place-items-center rounded-full border bg-card text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={t("openAlert")}
              >
                <DirectionIcon className="size-5" aria-hidden="true" />
              </a>
            ) : null}
          </section>
        ) : null}

        <section className="mt-4 rounded-3xl border border-secondary/20 bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-primary">{t("summaryTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("summaryDescription")}</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/student/progress">{t("openProgress")}</Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryMetric
              icon={Gauge}
              label={t("weeklyPlan")}
              value={plan ? t("percentValue", { value: number.format(weeklyPlan) }) : t("pending")}
            />
            <SummaryMetric
              icon={BookOpenCheck}
              label={t("masteredPages")}
              value={number.format(progressData.metrics.masteredPages)}
            />
            <SummaryMetric
              icon={CalendarCheck2}
              label={t("attendance")}
              value={
                attendance == null
                  ? t("pending")
                  : t("percentValue", { value: number.format(attendance) })
              }
            />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-secondary/20 bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-secondary/12 text-secondary">
              <ListChecks className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-black text-primary">{t("currentWork")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {progressData.review.due || progressData.homework
                  ? t("currentWorkDescription", { count: progressData.review.due })
                  : t("nothingDue")}
              </p>
            </div>
          </div>
          {progressData.homework ? (
            <p className="mt-4 rounded-2xl bg-accent/45 p-4 text-sm leading-7 text-foreground">
              {progressData.homework}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <article className="flex min-h-24 items-center gap-3 rounded-2xl bg-background/70 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/7 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <strong className="mt-1 block text-lg font-black text-primary">{value}</strong>
      </div>
    </article>
  );
}
