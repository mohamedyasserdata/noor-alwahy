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
      <article className="mt-8 rounded-3xl border border-dashed bg-card p-6 sm:p-8">
        <CalendarClock className="size-7 text-secondary" aria-hidden="true" />
        <h2 className="mt-5 text-xl font-black text-primary">{t("emptyTitle")}</h2>
        <p className="mt-2 leading-7 text-muted-foreground">{t("emptyDescription")}</p>
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
    <article className="relative mt-8 overflow-hidden rounded-3xl border bg-card shadow-card">
      <div className="absolute inset-y-0 start-0 w-1.5 bg-secondary" aria-hidden="true" />
      <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-secondary">
              <Video className="size-5" aria-hidden="true" />
            </span>
            <Badge variant={windowState.phase === "open" ? "success" : "outline"}>
              {t(`states.${windowState.phase}`)}
            </Badge>
          </div>
          <h2 className="mt-6 text-2xl font-black text-primary sm:text-3xl">{t("cardTitle")}</h2>
          <p className="mt-3 flex items-center gap-2 font-bold text-foreground">
            <CalendarClock className="size-4 text-secondary" aria-hidden="true" />
            {session.dateLabel} · {session.timeLabel}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{session.timezone}</p>
          <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
            {session.studentName ? (
              <div>
                <dt className="text-muted-foreground">{t("student")}</dt>
                <dd className="font-bold text-primary">{session.studentName}</dd>
              </div>
            ) : null}
            {session.teacherName ? (
              <div>
                <dt className="text-muted-foreground">{t("teacher")}</dt>
                <dd className="font-bold text-primary">{session.teacherName}</dd>
              </div>
            ) : null}
          </dl>
          {windowState.canJoin && (session.meetingId || session.passcode) ? (
            <dl className="mt-5 grid gap-2 rounded-2xl bg-accent/55 p-4 text-sm sm:grid-cols-2">
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
        </div>

        <div className="rounded-3xl bg-primary p-5 text-primary-foreground sm:p-6">
          <Clock3 className="size-6 text-secondary" aria-hidden="true" />
          <p className="mt-4 text-sm text-primary-foreground/75">{countdownLabel}</p>
          <p className="mt-1 text-3xl font-black tabular-nums" aria-live="polite" dir="ltr">
            {windowState.phase === "closed"
              ? "00:00:00"
              : formatCountdown(windowState.remainingSeconds)}
          </p>
          <div className="mt-5">
            {canOpen && session.joinUrl ? (
              <Button asChild variant="gold" size="lg" className="w-full">
                <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
                  <Video aria-hidden="true" /> {t("join")}
                </a>
              </Button>
            ) : (
              <Button disabled variant="gold" size="lg" className="w-full">
                <Video aria-hidden="true" />
                {windowState.canJoin ? t("preparing") : t("join")}
              </Button>
            )}
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-primary-foreground/70">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
            {t("privacy")}
          </p>
        </div>
      </div>
    </article>
  );
}
