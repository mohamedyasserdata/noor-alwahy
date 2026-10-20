"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { wallClockToUtc } from "@/lib/time";
import {
  makeupSessionSchema,
  rescheduleSessionSchema,
  scheduleSlotSchema,
  substituteSessionSchema,
} from "@/lib/validators/schedules";

export async function saveScheduleSlotAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const parsed = scheduleSlotSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    weekday: formData.get("weekday"),
    localStartTime: formData.get("localStartTime"),
    durationMin: formData.get("durationMin"),
    anchorTimezone: formData.get("anchorTimezone"),
  });
  if (!parsed.success) go(locale, "scheduleError", "invalid_fields");
  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_slots").insert({
    assignment_id: value.assignmentId,
    weekday: value.weekday,
    local_start_time: value.localStartTime,
    duration_min: value.durationMin,
    anchor_timezone: value.anchorTimezone,
  });
  if (error)
    go(
      locale,
      "scheduleError",
      error.message.includes("duplicate") ? "duplicate" : "request_failed",
    );
  for (const portal of ["admin", "teacher", "student", "parent"]) {
    revalidatePath(`/${locale}/${portal}/schedule`);
  }
  go(locale, "scheduleStatus", "saved");
}

export async function assignSessionSubstituteAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = normalizeLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = substituteSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    substituteTeacherId: formData.get("substituteTeacherId"),
    scope: formData.get("scope"),
  });
  if (!parsed.success) go(locale, "adjustmentError", "invalid_fields");

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_session_substitute", {
    p_session_id: parsed.data.sessionId,
    p_substitute_teacher_id: parsed.data.substituteTeacherId,
    p_scope: parsed.data.scope,
  });
  if (error) go(locale, "adjustmentError", adjustmentError(error.code, error.message));

  revalidateSchedulePortals(locale);
  go(locale, "adjustmentStatus", "substitute_saved");
}

export async function createMakeupSessionAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = normalizeLocale(localeValue);
  const { user } = await requireRole("admin", locale);
  const parsed = makeupSessionSchema.safeParse({
    entitlementId: formData.get("entitlementId"),
    teacherId: formData.get("teacherId"),
    scheduledLocal: formData.get("scheduledLocal"),
  });
  if (!parsed.success) go(locale, "adjustmentError", "invalid_fields");

  const supabase = await createClient();
  const scheduledAt = await adminLocalToUtc(supabase, user.id, parsed.data.scheduledLocal);
  if (!scheduledAt) go(locale, "adjustmentError", "invalid_time");

  const { error } = await supabase.rpc("create_makeup_session", {
    p_entitlement_id: parsed.data.entitlementId,
    p_scheduled_at: scheduledAt,
    ...(parsed.data.teacherId ? { p_teacher_id: parsed.data.teacherId } : {}),
  });
  if (error) go(locale, "adjustmentError", adjustmentError(error.code, error.message));

  revalidateSchedulePortals(locale);
  go(locale, "adjustmentStatus", "makeup_saved");
}

export async function rescheduleSessionAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = normalizeLocale(localeValue);
  const { user } = await requireRole("admin", locale);
  const parsed = rescheduleSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    scheduledLocal: formData.get("scheduledLocal"),
  });
  if (!parsed.success) go(locale, "adjustmentError", "invalid_fields");

  const supabase = await createClient();
  const scheduledAt = await adminLocalToUtc(supabase, user.id, parsed.data.scheduledLocal);
  if (!scheduledAt) go(locale, "adjustmentError", "invalid_time");

  const { error } = await supabase.rpc("reschedule_session", {
    p_session_id: parsed.data.sessionId,
    p_scheduled_at: scheduledAt,
  });
  if (error) go(locale, "adjustmentError", adjustmentError(error.code, error.message));

  revalidateSchedulePortals(locale);
  go(locale, "adjustmentStatus", "rescheduled");
}

function normalizeLocale(localeValue: string): AppLocale {
  return routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
}

async function adminLocalToUtc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  localDateTime: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  if (error) return null;
  const [date, time] = localDateTime.split("T");
  if (!date || !time) return null;
  const result = wallClockToUtc({ date, time, timeZone: data.timezone });
  return result.ok ? result.value.utcIso : null;
}

function adjustmentError(code: string, message: string) {
  if (message.includes("gender_mismatch")) return "gender_mismatch";
  if (message.includes("teacher_not_eligible")) return "teacher_not_eligible";
  if (message.includes("makeup_entitlement_unavailable")) return "entitlement_unavailable";
  if (message.includes("session_not_adjustable")) return "session_not_adjustable";
  if (code === "23P01") return "conflict";
  return "request_failed";
}

function revalidateSchedulePortals(locale: AppLocale) {
  for (const portal of ["admin", "teacher", "student", "parent"]) {
    revalidatePath(`/${locale}/${portal}/schedule`);
  }
}

function go(locale: AppLocale, key: string, value: string): never {
  redirect(`/${locale}/admin/schedule?${new URLSearchParams({ [key]: value })}` as Route);
}
