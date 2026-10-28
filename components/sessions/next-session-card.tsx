"use client";

import { CalendarClock, Clock3, ShieldCheck, UserRound, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatCountdown, getJoinWindowState } from "@/lib/sessions/countdown";

type SessionCard = {
  id: string;
  scheduledAtMs: number;
  endsAtMs: number;
  dateLabel: string;
  timeLabel: string;
  timezone: string;
  studentName: string | null;
  teacherName: string | null;
  joinUrl: string | null;
  meetingId: string | null;
  passcode: string | null;
};

export function NextSessionCard({
  appearance = "standard",
  serverNowMs,
  session,
}: {
  appearance?: "standard" | "student-home";
  serverNowMs: number;
  session: SessionCard | null;
}) {
  const t = useTranslations("nextSession");

  if (!session) {
    if (appearance === "student-home") {
      return (
        <article className="rounded-[1.75rem] border border-secondary/25 bg-card/96 p-5 shadow-[0_1.25rem_3.5rem_-2rem_rgb(15_37_71_/_0.35)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#f7ecd4] text-[#a96f11] dark:bg-accent dark:text-secondary">
              <CalendarClock className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-primary">{t("emptyTitle")}</h2>
              <p className="mt-1 leading-7 text-muted-foreground">{t("emptyDescription")}</p>
            </div>
            <Button asChild variant="outline" className="shrink-0 border-secondary/45">
              <Link href="/student/schedule">{t("viewSchedule")}</Link>
            </Button>
          </div>
        </article>
      );
    }

    return (
      <article className="rounded-3xl border border-dashed border-secondary/40 bg-card/96 p-6 text-center shadow-card backdrop-blur sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary/14 text-secondary ring-1 ring-secondary/25">
          <CalendarClock className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-black text-primary">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl leading-7 text-muted-foreground">
          {t("emptyDescription")}
        </p>
      </article>
    );
  }

  return <LiveSessionCard appearance={appearance} serverNowMs={serverNowMs} session={session} />;
}

function LiveSessionCard({
  appearance,
  serverNowMs,
  session,
}: {
  appearance: "standard" | "student-home";
  serverNowMs: number;
  session: SessionCard;
}) {
  const t = useTranslations("nextSession");
  const router = useRouter();
  const [nowMs, setNowMs] = useState(serverNowMs);
  const refreshAttempted = useRef(false);
  const windowState = getJoinWindowState(nowMs, session.scheduledAtMs, session.endsAtMs);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session.id]);

  useEffect(() => {
    if (windowState.canJoin && !session.joinUrl && !refreshAttempted.current) {
      refreshAttempted.current = true;
      router.refresh();
    }
  }, [router, session.joinUrl, windowState.canJoin]);

  const canOpen = windowState.canJoin && Boolean(session.joinUrl);
  const countdownLabel =
    windowState.phase === "before"
      ? t("opensIn")
      : windowState.phase === "open"
        ? t("windowOpen")
        : t("windowClosed");

  if (appearance === "student-home") {
    return (
      <article className="rounded-[1.75rem] border border-secondary/25 bg-card/96 p-5 shadow-[0_1.25rem_3.5rem_-2rem_rgb(15_37_71_/_0.35)] backdrop-blur sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#f7ecd4] text-[#a96f11] dark:bg-accent dark:text-secondary">
              <CalendarClock className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-primary">{t("cardTitle")}</h2>
                <Badge variant={windowState.phase === "open" ? "success" : "outline"}>
                  {t(`states.${windowState.phase}`)}
                </Badge>
              </div>
              <p className="mt-2 font-bold text-foreground">
                {session.dateLabel} · <span dir="ltr">{session.timeLabel}</span>
              </p>
              {session.teacherName ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRound className="size-4 text-secondary" aria-hidden="true" />
                  {t("teacher")}: {session.teacherName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-[#f8f1e2] px-5 py-3 text-center dark:bg-accent/45">
            <p className="text-xs font-bold text-muted-foreground">{countdownLabel}</p>
            <p
              className="mt-1 text-xl font-black text-primary tabular-nums"
              aria-live="polite"
              dir="ltr"
            >
              {windowState.phase === "closed"
                ? "00:00:00"
                : formatCountdown(windowState.remainingSeconds)}
            </p>
          </div>

          {canOpen && session.joinUrl ? (
            <Button asChild size="lg" className="min-w-48">
              <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
                <Video aria-hidden="true" /> {t("join")}
              </a>
            </Button>
          ) : (
            <Button disabled size="lg" className="min-w-48">
              <Video aria-hidden="true" />
              {windowState.canJoin ? t("preparing") : t("join")}
            </Button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-3xl border border-secondary/30 bg-card/96 shadow-soft backdrop-blur">
      <div className="absolute inset-y-0 start-0 w-1 bg-secondary" aria-hidden="true" />
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(13rem,1.15fr)_minmax(11rem,0.9fr)_minmax(10rem,0.8fr)_minmax(13rem,0.95fr)] lg:items-center lg:divide-x lg:divide-border/70 lg:divide-x-reverse">
        <div className="min-w-0 lg:px-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-secondary/15 text-secondary ring-1 ring-secondary/20">
              <Video className="size-5" aria-hidden="true" />
            </span>
            <Badge variant={windowState.phase === "open" ? "success" : "outline"}>
              {t(`states.${windowState.phase}`)}
            </Badge>
          </div>
          <h2 className="mt-3 truncate text-xl font-black text-primary">{t("cardTitle")}</h2>
        </div>

        <div className="min-w-0 lg:px-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4 shrink-0 text-secondary" aria-hidden="true" />
            {t("dateAndTime")}
          </p>
          <p className="mt-1 font-black text-primary">{session.dateLabel}</p>
          <p className="mt-1 text-sm font-bold text-foreground tabular-nums" dir="ltr">
            {session.timeLabel}
          </p>
        </div>

        <div className="min-w-0 lg:px-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserRound className="size-4 shrink-0 text-secondary" aria-hidden="true" />
            {t("teacher")}
          </p>
          <p className="mt-1 truncate font-black text-primary">
            {session.teacherName ?? t("teacherPending")}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{session.timezone}</p>
        </div>

        <div className="rounded-2xl bg-primary p-4 text-primary-foreground lg:ms-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-primary-foreground/75">{countdownLabel}</p>
              <p className="mt-1 text-xl font-black tabular-nums" aria-live="polite" dir="ltr">
                {windowState.phase === "closed"
                  ? "00:00:00"
                  : formatCountdown(windowState.remainingSeconds)}
              </p>
            </div>
            <Clock3 className="size-5 shrink-0 text-secondary" aria-hidden="true" />
          </div>
          <div className="mt-3">
            {canOpen && session.joinUrl ? (
              <Button asChild variant="gold" className="w-full">
                <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
                  <Video aria-hidden="true" /> {t("join")}
                </a>
              </Button>
            ) : (
              <Button disabled variant="gold" className="w-full">
                <Video aria-hidden="true" />
                {windowState.canJoin ? t("preparing") : t("join")}
              </Button>
            )}
          </div>
        </div>
      </div>
      {windowState.canJoin && (session.meetingId || session.passcode) ? (
        <dl className="mx-5 mb-5 grid gap-3 rounded-2xl bg-accent/45 p-4 text-sm sm:grid-cols-2 sm:px-6">
          {session.meetingId ? (
            <div>
              <dt className="text-muted-foreground">{t("meetingId")}</dt>
              <dd className="font-bold" dir="ltr">
                {session.meetingId}
              </dd>
            </div>
          ) : null}
          {session.passcode ? (
            <div>
              <dt className="text-muted-foreground">{t("passcode")}</dt>
              <dd className="font-bold" dir="ltr">
                {session.passcode}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <p className="flex items-start gap-2 border-t border-secondary/15 px-5 py-3 text-xs leading-6 text-muted-foreground sm:px-6">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
        {t("privacy")}
      </p>
    </article>
  );
}
