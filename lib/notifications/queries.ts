import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { notificationPriority } from "@/lib/notifications/priority";

export type NotificationItem = {
  id: string;
  type: string;
  createdAt: string;
  readAt: string | null;
  payload: NotificationPayload;
};

export type NotificationPayload = {
  titleAr?: string;
  titleEn?: string;
  bodyAr?: string;
  bodyEn?: string;
  href?: string;
};

export type NotificationPreferences = {
  inApp: boolean;
  scheduleChanged: boolean;
  zoomLinkChanged: boolean;
  announcement: boolean;
  intervention: boolean;
  interventionEmail: boolean;
};

export type NotificationCenterData = {
  userId: string;
  items: NotificationItem[];
  preferences: NotificationPreferences;
};

const defaultPreferences: NotificationPreferences = {
  inApp: true,
  scheduleChanged: true,
  zoomLinkChanged: true,
  announcement: true,
  intervention: true,
  interventionEmail: true,
};

export async function getNotificationCenter(): Promise<NotificationCenterData | null> {
  await connection();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [notificationResult, preferenceResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,type,payload,created_at,read_at")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("notification_prefs").select("prefs").maybeSingle(),
  ]);
  if (notificationResult.error || preferenceResult.error) {
    throw new Error("notifications_unavailable");
  }

  return {
    userId: user.id,
    items: (notificationResult.data ?? [])
      .map((item) => ({
        id: item.id,
        type: item.type,
        createdAt: item.created_at,
        readAt: item.read_at,
        payload: readPayload(item.payload),
      }))
      .sort(
        (left, right) =>
          notificationPriority(left.type) - notificationPriority(right.type) ||
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      ),
    preferences: readPreferences(preferenceResult.data?.prefs),
  };
}

function readPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultPreferences;
  const prefs = value as Record<string, unknown>;
  return {
    inApp: typeof prefs.in_app === "boolean" ? prefs.in_app : true,
    scheduleChanged: typeof prefs.schedule_changed === "boolean" ? prefs.schedule_changed : true,
    zoomLinkChanged: typeof prefs.zoom_link_changed === "boolean" ? prefs.zoom_link_changed : true,
    announcement: typeof prefs.announcement === "boolean" ? prefs.announcement : true,
    intervention: typeof prefs.intervention === "boolean" ? prefs.intervention : true,
    interventionEmail:
      typeof prefs.intervention_email === "boolean" ? prefs.intervention_email : true,
  };
}

function readPayload(value: unknown): NotificationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const payload = value as Record<string, unknown>;
  return {
    titleAr: typeof payload.title_ar === "string" ? payload.title_ar : undefined,
    titleEn: typeof payload.title_en === "string" ? payload.title_en : undefined,
    bodyAr: typeof payload.body_ar === "string" ? payload.body_ar : undefined,
    bodyEn: typeof payload.body_en === "string" ? payload.body_en : undefined,
    href:
      typeof payload.action_href === "string" &&
      /^\/(ar|en)\/(admin|teacher|student|parent)\//.test(payload.action_href)
        ? payload.action_href
        : undefined,
  };
}
