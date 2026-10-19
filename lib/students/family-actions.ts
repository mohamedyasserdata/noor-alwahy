"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  familyAccountSchema,
  guardianLinkSchema,
  removeGuardianLinkSchema,
} from "@/lib/validators/student-family";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(
  locale: AppLocale,
  studentId: string,
  key: "familyError" | "familyStatus",
  value: string,
): never {
  redirect(
    `/${locale}/admin/students?${new URLSearchParams({ student: studentId, [key]: value })}` as Route,
  );
}

function refresh(locale: AppLocale) {
  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit`);
}

export async function saveGuardianLinkAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = guardianLinkSchema.safeParse({
    studentId: formData.get("studentId"),
    parentProfileId: formData.get("parentProfileId"),
    relation: formData.get("relation") || undefined,
    isPrimary: formData.get("isPrimary") === "on" ? "true" : "false",
    isPayer: formData.get("isPayer") === "on" ? "true" : "false",
  });
  if (!parsed.success)
    go(locale, String(formData.get("studentId") ?? ""), "familyError", "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_student_guardian", {
    p_is_payer: parsed.data.isPayer,
    p_is_primary: parsed.data.isPrimary,
    p_parent_profile_id: parsed.data.parentProfileId,
    p_relation: parsed.data.relation ?? "",
    p_student_id: parsed.data.studentId,
  });
  if (error) go(locale, parsed.data.studentId, "familyError", "request_failed");
  refresh(locale);
  go(locale, parsed.data.studentId, "familyStatus", "linked");
}

export async function removeGuardianLinkAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = removeGuardianLinkSchema.safeParse({
    studentId: formData.get("studentId"),
    guardianId: formData.get("guardianId"),
  });
  if (!parsed.success)
    go(locale, String(formData.get("studentId") ?? ""), "familyError", "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_student_guardian", {
    p_guardian_id: parsed.data.guardianId,
    p_student_id: parsed.data.studentId,
  });
  if (error) go(locale, parsed.data.studentId, "familyError", "request_failed");
  refresh(locale);
  go(locale, parsed.data.studentId, "familyStatus", "unlinked");
}

export async function createFamilyAccountAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const { user } = await requireRole("admin", locale);
  const parsed = familyAccountSchema.safeParse({
    studentId: formData.get("studentId"),
    role: formData.get("role"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    temporaryPassword: formData.get("temporaryPassword"),
    relation: formData.get("relation") || undefined,
    isPrimary: formData.get("isPrimary") === "on" ? "true" : "false",
    isPayer: formData.get("isPayer") === "on" ? "true" : "false",
  });
  if (!parsed.success)
    go(locale, String(formData.get("studentId") ?? ""), "familyError", "invalid_fields");

  const value = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    app_metadata: { created_by: user.id, role: value.role },
    email: value.email,
    email_confirm: true,
    password: value.temporaryPassword,
    user_metadata: {
      created_by: user.id,
      full_name: value.fullName,
      gender: "male",
      role: value.role,
      ...(value.role === "student" ? { student_id: value.studentId } : {}),
    },
  });
  if (error || !data.user) {
    const code =
      error && /already|registered|exists/i.test(error.message)
        ? "account_exists"
        : "request_failed";
    go(locale, value.studentId, "familyError", code);
  }

  if (value.role === "parent") {
    const supabase = await createClient();
    const { error: linkError } = await supabase.rpc("upsert_student_guardian", {
      p_is_payer: value.isPayer,
      p_is_primary: value.isPrimary,
      p_parent_profile_id: data.user.id,
      p_relation: value.relation ?? "",
      p_student_id: value.studentId,
    });
    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      go(locale, value.studentId, "familyError", "request_failed");
    }
  }

  refresh(locale);
  go(
    locale,
    value.studentId,
    "familyStatus",
    value.role === "parent" ? "parent_created" : "student_created",
  );
}
