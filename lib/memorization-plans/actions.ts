"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { memorizationPlanSchema } from "@/lib/validators/memorization-plan";

export async function saveMemorizationPlanAction(localeValue: string, formData: FormData) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  const { user } = await requireRole("teacher", locale);
  const parsed = memorizationPlanSchema.safeParse({
    studentId: formData.get("studentId"),
    weeklyTargetPages: formData.get("weeklyTargetPages"),
    monthlyTargetPages: formData.get("monthlyTargetPages"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
  });
  if (!parsed.success) go(locale, "invalid_fields");

  const value = parsed.data;
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("memorization_plans")
    .select("id")
    .eq("student_id", value.studentId)
    .maybeSingle();
  if (readError) go(locale, "request_failed");

  const payload = {
    weekly_target_pages: value.weeklyTargetPages,
    monthly_target_pages: value.monthlyTargetPages,
    starts_on: value.startsOn,
    ends_on: value.endsOn || null,
    updated_by: user.id,
  };
  const result = existing
    ? await supabase.from("memorization_plans").update(payload).eq("id", existing.id)
    : await supabase.from("memorization_plans").insert({
        ...payload,
        student_id: value.studentId,
        created_by: user.id,
      });
  if (result.error) go(locale, "request_failed");

  revalidatePath(`/${locale}/teacher/students`);
  revalidatePath(`/${locale}/student/progress`);
  redirect(`/${locale}/teacher/students?planStatus=saved` as Route);
}

function go(locale: AppLocale, code: string): never {
  redirect(`/${locale}/teacher/students?planError=${code}` as Route);
}
