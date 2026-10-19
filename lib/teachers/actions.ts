"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  availabilityMutationSchema,
  availabilityReviewSchema,
  availabilitySchema,
  teacherFormSchema,
} from "@/lib/validators/teachers";

function localeOf(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(locale: AppLocale, portal: "admin" | "teacher", key: string, value: string): never {
  redirect(
    `/${locale}/${portal}/${portal === "admin" ? "teachers" : "availability"}?${new URLSearchParams({ [key]: value })}` as Route,
  );
}

export async function saveTeacherAction(localeValue: string, formData: FormData): Promise<never> {
  const locale = localeOf(localeValue);
  await requireRole("admin", locale);
  const parsed = teacherFormSchema.safeParse({
    teacherId: formData.get("teacherId") || null,
    profileId: formData.get("profileId"),
    gender: formData.get("gender"),
    specialization: formData.get("specialization"),
    ijazahRiwaya: formData.get("ijazahRiwaya"),
    ijazahSanad: formData.get("ijazahSanad"),
    maxStudents: formData.get("maxStudents"),
    status: formData.get("status"),
    identityVerified: formData.get("identityVerified") === "on",
    trackIds: formData.getAll("trackIds"),
  });
  if (!parsed.success) go(locale, "admin", "teacherError", "invalid_fields");
  const value = parsed.data;
  const ijazah =
    value.ijazahRiwaya || value.ijazahSanad
      ? [{ riwaya: value.ijazahRiwaya, sanad: value.ijazahSanad }]
      : [];
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_teacher", {
    p_payload: {
      teacher_id: value.teacherId,
      profile_id: value.profileId,
      gender: value.gender,
      specialization: value.specialization,
      ijazah_info: ijazah,
      max_students: value.maxStudents,
      status: value.status,
      identity_verified: value.identityVerified,
      track_ids: value.trackIds,
    },
  });
  if (error)
    go(
      locale,
      "admin",
      "teacherError",
      error.message.includes("teacher_activation_requirements")
        ? "activation_requirements"
        : "request_failed",
    );
  revalidatePath(`/${locale}/admin/teachers`);
  go(locale, "admin", "teacherStatus", value.teacherId ? "updated" : "created");
}

export async function reviewAvailabilityAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = localeOf(localeValue);
  await requireRole("admin", locale);
  const parsed = availabilityReviewSchema.safeParse({
    availabilityId: formData.get("availabilityId"),
    status: formData.get("status"),
  });
  if (!parsed.success) go(locale, "admin", "teacherError", "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_availability")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.availabilityId)
    .eq("status", "proposed");
  if (error) go(locale, "admin", "teacherError", "request_failed");
  revalidatePath(`/${locale}/admin/teachers`);
  revalidatePath(`/${locale}/teacher/availability`);
  go(locale, "admin", "teacherStatus", parsed.data.status);
}

export async function acceptConductAction(localeValue: string): Promise<never> {
  const locale = localeOf(localeValue);
  await requireRole("teacher", locale);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_teacher_code_of_conduct");
  if (error) go(locale, "teacher", "availabilityError", "request_failed");
  revalidatePath(`/${locale}/teacher/availability`);
  revalidatePath(`/${locale}/admin/teachers`);
  go(locale, "teacher", "availabilityStatus", "conduct_accepted");
}

export async function proposeAvailabilityAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = localeOf(localeValue);
  await requireRole("teacher", locale);
  const parsed = availabilitySchema.safeParse({
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) go(locale, "teacher", "availabilityError", "invalid_fields");
  const supabase = await createClient();
  const { data: teacher } = await supabase.from("teachers").select("id").maybeSingle();
  if (!teacher) go(locale, "teacher", "availabilityError", "profile_missing");
  const { error } = await supabase.from("teacher_availability").insert({
    teacher_id: teacher.id,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });
  if (error) go(locale, "teacher", "availabilityError", "request_failed");
  revalidatePath(`/${locale}/teacher/availability`);
  revalidatePath(`/${locale}/admin/teachers`);
  go(locale, "teacher", "availabilityStatus", "proposed");
}

export async function deleteAvailabilityAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = localeOf(localeValue);
  await requireRole("teacher", locale);
  const parsed = availabilityMutationSchema.safeParse({
    availabilityId: formData.get("availabilityId"),
  });
  if (!parsed.success) go(locale, "teacher", "availabilityError", "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_availability")
    .delete()
    .eq("id", parsed.data.availabilityId);
  if (error) go(locale, "teacher", "availabilityError", "request_failed");
  revalidatePath(`/${locale}/teacher/availability`);
  revalidatePath(`/${locale}/admin/teachers`);
  go(locale, "teacher", "availabilityStatus", "deleted");
}
