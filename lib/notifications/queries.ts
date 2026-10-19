import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  type: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPreferences = {
  inApp: boolean;
  scheduleChanged: boolean;
  zoomLinkChanged: boolean;
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
      .select("id,type,created_at,read_at")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("notification_prefs").select("prefs").maybeSingle(),
  ]);
  if (notificationResult.error || preferenceResult.error) {
    throw new Error("notifications_unavailable");
  }

  return {
    userId: user.id,
    items: (notificationResult.data ?? []).map((item) => ({
      id: item.id,
      type: item.type,
      createdAt: item.created_at,
      readAt: item.read_at,
    })),
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
  };
}
