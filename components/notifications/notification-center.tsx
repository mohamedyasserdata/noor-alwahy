"use client";

import { Bell, CheckCheck, LoaderCircle, Settings2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import type { PortalId } from "@/components/portal/portal-config";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  saveNotificationPreferencesAction,
} from "@/lib/notifications/actions";
import type {
  NotificationCenterData,
  NotificationItem,
  NotificationPreferences,
} from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NotificationCenterProps = {
  initialData: NotificationCenterData;
  portal: PortalId;
};

export function NotificationCenter({ initialData, portal }: NotificationCenterProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("notifications");
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialData.items);
  const [preferences, setPreferences] = useState(initialData.preferences);
  const [open, setOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");
  const [pending, startTransition] = useTransition();
  const unreadCount = items.filter((item) => !item.readAt).length;

  const refreshItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,created_at,read_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) return;
    setItems(
      data.map((item) => ({
        id: item.id,
        type: item.type,
        createdAt: item.created_at,
        readAt: item.read_at,
      })),
    );
  }, [supabase]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    async function subscribe() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setRealtimeStatus("signed_out");
        return;
      }

      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`notifications:${initialData.userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${initialData.userId}`,
          },
          () => void refreshItems(),
        )
        .subscribe((nextStatus) => {
          if (!active) return;
          setRealtimeStatus(nextStatus.toLowerCase());
        });
    }

    void subscribe();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [initialData.userId, refreshItems, supabase]);

  function markRead(item: NotificationItem) {
    if (item.readAt) return;
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((candidate) => (candidate.id === item.id ? { ...candidate, readAt } : candidate)),
    );
    startTransition(async () => {
      try {
        await markNotificationReadAction(locale, portal, item.id);
      } catch {
        setStatus("error");
        await refreshItems();
      }
    });
  }

  function markAllRead() {
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction(locale, portal);
      } catch {
        setStatus("error");
        await refreshItems();
      }
    });
  }

  function savePreferences() {
    setStatus("idle");
    startTransition(async () => {
      try {
        await saveNotificationPreferencesAction(locale, portal, preferences);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <div
      className="fixed end-3 top-2.5 z-50 min-[769px]:end-5 min-[769px]:top-5"
      data-realtime-status={realtimeStatus}
    >
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="relative rounded-full bg-card/96 shadow-card backdrop-blur"
        aria-label={t("open")}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute -end-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[0.65rem] font-black text-secondary-foreground ring-2 ring-background"
            aria-label={t("unreadCount", { count: unreadCount })}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <section
          id="notification-panel"
          className="mt-2 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-card shadow-[0_1rem_3rem_-1rem_rgb(15_37_71_/_0.35)]"
          aria-labelledby="notification-title"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 id="notification-title" className="font-black text-primary">
                {t("title")}
              </h2>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {t("unreadCount", { count: unreadCount })}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("markAllRead")}
                disabled={pending || unreadCount === 0}
                onClick={markAllRead}
              >
                <CheckCheck aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("preferences")}
                aria-pressed={showPreferences}
                onClick={() => setShowPreferences((current) => !current)}
              >
                <Settings2 aria-hidden="true" />
              </Button>
            </div>
          </div>

          {showPreferences ? (
            <Preferences
              preferences={preferences}
              pending={pending}
              status={status}
              onChange={setPreferences}
              onSave={savePreferences}
            />
          ) : (
            <NotificationList items={items} locale={locale} onRead={markRead} />
          )}
        </section>
      ) : null}
    </div>
  );
}

function NotificationList({
  items,
  locale,
  onRead,
}: {
  items: NotificationItem[];
  locale: AppLocale;
  onRead: (item: NotificationItem) => void;
}) {
  const t = useTranslations("notifications");
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }
  return (
    <ul className="max-h-[min(26rem,65vh)] overflow-y-auto p-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={cn(
              "flex min-h-16 w-full items-start gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-accent/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              !item.readAt && "bg-secondary/10",
            )}
            onClick={() => onRead(item)}
          >
            <span
              className={cn(
                "mt-2 size-2 shrink-0 rounded-full",
                item.readAt ? "bg-muted-foreground/30" : "bg-secondary",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">
                {notificationTitle(item.type, t)}
              </span>
              <time className="mt-1 block text-xs text-muted-foreground" dateTime={item.createdAt}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(item.createdAt))}
              </time>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Preferences({
  preferences,
  pending,
  status,
  onChange,
  onSave,
}: {
  preferences: NotificationPreferences;
  pending: boolean;
  status: "idle" | "saved" | "error";
  onChange: (value: NotificationPreferences) => void;
  onSave: () => void;
}) {
  const t = useTranslations("notifications");
  const options: Array<[keyof NotificationPreferences, string]> = [
    ["inApp", t("inApp")],
    ["scheduleChanged", t("scheduleChanged")],
    ["zoomLinkChanged", t("zoomLinkChanged")],
  ];
  return (
    <div className="grid gap-4 p-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("preferencesDescription")}</p>
      <div className="grid gap-2">
        {options.map(([key, label]) => (
          <label
            key={key}
            className="flex min-h-11 items-center justify-between gap-4 rounded-xl border px-3 py-2 text-sm font-bold"
          >
            <span>{label}</span>
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={preferences[key]}
              disabled={key !== "inApp" && !preferences.inApp}
              onChange={(event) => onChange({ ...preferences, [key]: event.target.checked })}
            />
          </label>
        ))}
      </div>
      <Button type="button" onClick={onSave} disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {pending ? t("saving") : t("save")}
      </Button>
      <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
        {status === "saved" ? t("saved") : status === "error" ? t("error") : ""}
      </p>
    </div>
  );
}

function notificationTitle(type: string, t: ReturnType<typeof useTranslations<"notifications">>) {
  if (type === "schedule_changed") return t("types.scheduleChanged");
  if (type === "zoom_link_changed") return t("types.zoomLinkChanged");
  if (type === "teacher_late") return t("types.teacherLate");
  if (type === "teacher_absence_threshold") return t("types.teacherAbsenceThreshold");
  if (type === "report_approved") return t("types.reportApproved");
  if (type === "payment_confirmed") return t("types.paymentConfirmed");
  if (type === "refund_confirmed") return t("types.refundConfirmed");
  return t("types.generic");
}
