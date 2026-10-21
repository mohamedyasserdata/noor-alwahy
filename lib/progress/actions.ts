"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { memorizationPlanSchema } from "@/lib/validators/memorization-plan";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(locale: AppLocale, key: "planError" | "planStatus", value: string): never {
  redirect(`/${locale}/teacher/students?${new URLSearchParams({ [key]: value })}` as Route);
}

export async function saveMemorizationPlanAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const { user } = await requireRole("teacher", locale);
  const parsed = memorizationPlanSchema.safeParse({
    studentId: formData.get("studentId"),
    weeklyTargetPages: formData.get("weeklyTargetPages"),
    monthlyTargetPages: formData.get("monthlyTargetPages"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn") ?? "",
  });
  if (!parsed.success) go(locale, "planError", "invalid_fields");

  const supabase = await createClient();
  const value = parsed.data;
  const { data: existing, error: existingError } = await supabase
    .from("memorization_plans")
    .select("id")
    .eq("student_id", value.studentId)
    .maybeSingle();
  if (existingError) go(locale, "planError", "request_failed");

  const payload = {
    weekly_target_pages: value.weeklyTargetPages,
    monthly_target_pages: value.monthlyTargetPages,
    starts_on: value.startsOn,
    ends_on: value.endsOn ?? null,
    updated_by: user.id,
  };
  const result = existing
    ? await supabase.from("memorization_plans").update(payload).eq("id", existing.id)
    : await supabase.from("memorization_plans").insert({
        ...payload,
        student_id: value.studentId,
        created_by: user.id,
      });
  if (result.error) go(locale, "planError", "request_failed");

  revalidatePath(`/${locale}/teacher/students`);
  revalidatePath(`/${locale}/student/progress`);
  go(locale, "planStatus", existing ? "updated" : "created");
}
