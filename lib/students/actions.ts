"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { archiveStudentSchema, studentFormSchema } from "@/lib/validators/students";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(locale: AppLocale, key: "studentError" | "studentStatus", value: string): never {
  redirect(`/${locale}/admin/students?${new URLSearchParams({ [key]: value })}` as Route);
}

export async function saveStudentAction(localeValue: string, formData: FormData): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = studentFormSchema.safeParse({
    studentId: formData.get("studentId") || null,
    fullName: formData.get("fullName"),
    gender: formData.get("gender"),
    birthDate: formData.get("birthDate") || undefined,
    status: formData.get("status"),
    levelId: formData.get("levelId") || undefined,
    joinedAt: formData.get("joinedAt"),
    countryCode: formData.get("countryCode") || undefined,
    timezone: formData.get("timezone"),
    healthNotes: formData.get("healthNotes") || undefined,
    specialNotes: formData.get("specialNotes") || undefined,
    shareWithTeacher: formData.get("shareWithTeacher") === "on" ? "true" : "false",
  });
  if (!parsed.success) go(locale, "studentError", "invalid_fields");

  const supabase = await createClient();
  const value = parsed.data;
  const { error } = await supabase.rpc("upsert_student", {
    p_payload: {
      birth_date: value.birthDate,
      country_code: value.countryCode,
      full_name: value.fullName,
      gender: value.gender,
      health_notes: value.healthNotes,
      joined_at: value.joinedAt,
      level_id: value.levelId,
      share_with_teacher: value.shareWithTeacher,
      special_notes: value.specialNotes,
      status: value.status,
      student_id: value.studentId,
      timezone: value.timezone,
    },
  });
  if (error) go(locale, "studentError", "request_failed");
  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/audit`);
  go(locale, "studentStatus", value.studentId ? "updated" : "created");
}

export async function archiveStudentAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = archiveStudentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) go(locale, "studentError", "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_student", { p_student_id: parsed.data.studentId });
  if (error) go(locale, "studentError", "request_failed");
  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/audit`);
  go(locale, "studentStatus", "archived");
}
