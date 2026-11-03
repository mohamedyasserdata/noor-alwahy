"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { isAllowedZoomUrl } from "@/lib/validators/teacher-zoom";

const zoomSchema = z.object({
  sessionId: z.uuid(),
  action: z.enum(["publish", "unpublish"]),
  joinUrl: z.string().trim().max(2048),
});

const stateSchema = z.object({ sessionId: z.uuid(), action: z.enum(["start", "end"]) });

export async function manageSessionZoomAction(localeValue: string, formData: FormData) {
  const locale = parseLocale(localeValue);
  await requireRole("teacher", locale);
  const parsed = zoomSchema.safeParse({
    sessionId: formData.get("sessionId"),
    action: formData.get("action"),
    joinUrl: formData.get("joinUrl") ?? "",
  });
  if (
    !parsed.success ||
    (parsed.data.action === "publish" && !isAllowedZoomUrl(parsed.data.joinUrl))
  ) {
    go(locale, String(formData.get("sessionId") ?? ""), "zoomError", "invalid_fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_session_zoom", {
    p_session_id: parsed.data.sessionId,
    p_action: parsed.data.action,
    p_join_url: parsed.data.action === "publish" ? parsed.data.joinUrl : undefined,
  });
  if (error) {
    const code = ["session_forbidden", "session_not_publishable", "invalid_zoom_url"].find((item) =>
      error.message.includes(item),
    );
    go(locale, parsed.data.sessionId, "zoomError", code ?? "request_failed");
  }
  refresh(locale, parsed.data.sessionId);
  go(locale, parsed.data.sessionId, "zoomStatus", parsed.data.action);
}

export async function updateTeacherSessionStateAction(localeValue: string, formData: FormData) {
  const locale = parseLocale(localeValue);
  await requireRole("teacher", locale);
  const parsed = stateSchema.safeParse({
    sessionId: formData.get("sessionId"),
    action: formData.get("action"),
  });
  if (!parsed.success)
    go(locale, String(formData.get("sessionId") ?? ""), "sessionError", "invalid_fields");

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_teacher_session_state", {
    p_session_id: parsed.data.sessionId,
    p_action: parsed.data.action,
  });
  if (error) {
    const code = [
      "session_forbidden",
      "session_not_startable",
      "session_not_endable",
      "session_too_early",
    ].find((item) => error.message.includes(item));
    go(locale, parsed.data.sessionId, "sessionError", code ?? "request_failed");
  }
  refresh(locale, parsed.data.sessionId);
  go(locale, parsed.data.sessionId, "sessionStatus", parsed.data.action);
}

function refresh(locale: AppLocale, sessionId: string) {
  revalidatePath(`/${locale}/teacher/sessions/${sessionId}`);
  revalidatePath(`/${locale}/teacher/today`);
  revalidatePath(`/${locale}/student/home`);
  revalidatePath(`/${locale}/student/schedule`);
}

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(locale: AppLocale, sessionId: string, key: string, value: string): never {
  const safeSessionId = z.uuid().safeParse(sessionId).success ? sessionId : "";
  const path = safeSessionId
    ? `/${locale}/teacher/sessions/${safeSessionId}`
    : `/${locale}/teacher/today`;
  redirect(`${path}?${new URLSearchParams({ [key]: value })}` as Route);
}
