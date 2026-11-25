"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  sessionId: z.uuid(),
  studentId: z.uuid(),
  action: z.enum(["approve", "reject"]),
});

export async function reviewSessionZoomAction(localeValue: string, formData: FormData) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const parsed = schema.safeParse({
    sessionId: formData.get("sessionId"),
    studentId: formData.get("studentId"),
    action: formData.get("action"),
  });
  if (!parsed.success) redirect(`/${locale}/admin/students` as Route);

  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_session_zoom", {
    p_session_id: parsed.data.sessionId,
    p_action: parsed.data.action,
  });
  const base = `/${locale}/admin/students/${parsed.data.studentId}`;
  if (error) redirect(`${base}?zoomError=request_failed` as Route);
  revalidatePath(base);
  revalidatePath(`/${locale}/teacher/sessions/${parsed.data.sessionId}`);
  revalidatePath(`/${locale}/teacher/today`);
  revalidatePath(`/${locale}/student/home`);
  revalidatePath(`/${locale}/parent/home`);
  redirect(`${base}?zoomStatus=${parsed.data.action}` as Route);
}
