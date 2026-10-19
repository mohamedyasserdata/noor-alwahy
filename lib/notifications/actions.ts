"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { portalIds, type PortalId } from "@/components/portal/portal-config";
import { routing, type AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const preferencesSchema = z.object({
  inApp: z.boolean(),
  scheduleChanged: z.boolean(),
  zoomLinkChanged: z.boolean(),
});

export async function markNotificationReadAction(
  localeValue: string,
  portalValue: string,
  notificationId: string,
) {
  const context = safeContext(localeValue, portalValue);
  const id = idSchema.parse(notificationId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("notification_update_failed");
  revalidatePath(`/${context.locale}/${context.portal}`, "layout");
}

export async function markAllNotificationsReadAction(localeValue: string, portalValue: string) {
  const context = safeContext(localeValue, portalValue);
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw new Error("notification_update_failed");
  revalidatePath(`/${context.locale}/${context.portal}`, "layout");
}

export async function saveNotificationPreferencesAction(
  localeValue: string,
  portalValue: string,
  input: unknown,
) {
  const context = safeContext(localeValue, portalValue);
  const preferences = preferencesSchema.parse(input);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("notification_auth_required");
  const prefs = {
    in_app: preferences.inApp,
    schedule_changed: preferences.scheduleChanged,
    zoom_link_changed: preferences.zoomLinkChanged,
  };
  const { data: updated, error: updateError } = await supabase
    .from("notification_prefs")
    .update({ prefs })
    .eq("user_id", userData.user.id)
    .select("user_id")
    .maybeSingle();
  if (updateError) throw new Error("notification_preferences_failed");
  if (!updated) {
    const { error: insertError } = await supabase
      .from("notification_prefs")
      .insert({ user_id: userData.user.id, prefs });
    if (insertError) throw new Error("notification_preferences_failed");
  }
  revalidatePath(`/${context.locale}/${context.portal}`, "layout");
}

function safeContext(localeValue: string, portalValue: string) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  if (!portalIds.includes(portalValue as PortalId)) throw new Error("invalid_portal");
  return { locale, portal: portalValue as PortalId };
}
