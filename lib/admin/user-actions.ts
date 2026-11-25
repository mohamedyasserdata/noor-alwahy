"use server";

import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createManagedAccountSchema,
  setAccountActiveSchema,
} from "@/lib/validators/user-management";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function redirectToUsers(locale: AppLocale, key: "error" | "status", value: string): never {
  redirect(`/${locale}/admin/users?${new URLSearchParams({ [key]: value })}` as Route);
}

export async function createManagedAccountAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = createManagedAccountSchema.safeParse({
    displayName: formData.get("displayName") || undefined,
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    gender: formData.get("gender") || undefined,
    mode: formData.get("mode"),
    role: formData.get("role"),
    temporaryPassword: formData.get("temporaryPassword") || undefined,
    packageId: formData.get("packageId") || "",
    countryCode: formData.get("countryCode") || "",
    startDate: formData.get("startDate") || "",
    weekdays: formData.getAll("weekdays"),
    localStartTime: formData.get("localStartTime") || "",
    durationMin: formData.get("durationMin") || 45,
    teacherWeekdays: formData.getAll("teacherWeekdays"),
    teacherStartTime: formData.get("teacherStartTime") || "",
    teacherEndTime: formData.get("teacherEndTime") || "",
    parentStudentId: formData.get("parentStudentId") || "",
    parentRelation: formData.get("parentRelation") || "guardian",
  });

  if (!parsed.success) {
    redirectToUsers(locale, "error", "invalid_fields");
  }

  const { user } = await requireRole("admin", locale);
  const admin = createAdminClient();
  const metadata = {
    created_by: user.id,
    display_name: parsed.data.displayName,
    full_name: parsed.data.fullName,
    gender: parsed.data.gender,
  };

  let error: { message: string } | null;
  let createdUserId: string | undefined;

  if (parsed.data.mode === "invite") {
    const requestHeaders = await headers();
    const originHeader = requestHeaders.get("origin");

    if (!originHeader) {
      redirectToUsers(locale, "error", "request_failed");
    }

    const callback = new URL(`/${locale}/auth/accept-invite`, new URL(originHeader).origin);
    const result = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { ...metadata, role: parsed.data.role },
      redirectTo: callback.toString(),
    });
    error = result.error;
    createdUserId = result.data.user?.id;
  } else {
    const result = await admin.auth.admin.createUser({
      app_metadata: { created_by: user.id, role: parsed.data.role },
      email: parsed.data.email,
      email_confirm: true,
      password: parsed.data.temporaryPassword,
      user_metadata: { ...metadata, role: parsed.data.role },
    });
    error = result.error;
    createdUserId = result.data.user?.id;
  }

  if (error) {
    const code = /already|registered|exists/i.test(error.message)
      ? "account_exists"
      : "request_failed";
    redirectToUsers(locale, "error", code);
  }

  let setupFailed = false;
  if (parsed.data.role === "parent" && createdUserId) {
    const supabase = await createClient();
    const { error: linkError } = await supabase.rpc("upsert_student_guardian", {
      p_is_payer: true,
      p_is_primary: true,
      p_parent_profile_id: createdUserId,
      p_relation: parsed.data.parentRelation,
      p_student_id: parsed.data.parentStudentId,
    });
    if (linkError) {
      await admin.auth.admin.deleteUser(createdUserId);
      redirectToUsers(locale, "error", "setup_failed");
    }
  }

  if (parsed.data.role === "student" && createdUserId) {
    const supabase = await createClient();
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("profile_id", createdUserId)
      .maybeSingle();

    if (student && parsed.data.packageId && parsed.data.countryCode && parsed.data.startDate) {
      const { error: subscriptionError } = await supabase.rpc("create_subscription", {
        p_student: student.id,
        p_package: parsed.data.packageId,
        p_country: parsed.data.countryCode,
        p_start_date: parsed.data.startDate,
        p_application: undefined,
      });
      setupFailed = Boolean(subscriptionError);
    }

    if (!setupFailed && student && parsed.data.weekdays.length && parsed.data.localStartTime) {
      const { data: track } = await supabase
        .from("tracks")
        .select("id")
        .eq("is_active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      if (track) {
        const query = new URLSearchParams({
          studentId: student.id,
          trackId: track.id,
          localStartTime: parsed.data.localStartTime,
          durationMin: String(parsed.data.durationMin),
        });
        parsed.data.weekdays.forEach((day) => query.append("weekdays", String(day)));
        revalidatePath(`/${locale}/admin/users`);
        redirect(`/${locale}/admin/assignments?${query}` as Route);
      }
    }
  }

  if (parsed.data.role === "teacher" && createdUserId && parsed.data.teacherWeekdays.length) {
    const supabase = await createClient();
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("profile_id", createdUserId)
      .maybeSingle();
    if (teacher && parsed.data.teacherStartTime && parsed.data.teacherEndTime) {
      const { error: availabilityError } = await supabase.from("teacher_availability").insert(
        parsed.data.teacherWeekdays.map((weekday) => ({
          teacher_id: teacher.id,
          weekday,
          start_time: parsed.data.teacherStartTime,
          end_time: parsed.data.teacherEndTime,
          status: "approved" as const,
        })),
      );
      setupFailed = Boolean(availabilityError);
    }
  }

  if (setupFailed) redirectToUsers(locale, "error", "setup_failed");

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit`);
  redirectToUsers(locale, "status", parsed.data.mode === "invite" ? "invited" : "created");
}

export async function setAccountActiveAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = setAccountActiveSchema.safeParse({
    profileId: formData.get("profileId"),
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    redirectToUsers(locale, "error", "invalid_fields");
  }

  await requireRole("admin", locale);
  const admin = createAdminClient();
  const banDuration = parsed.data.isActive ? "none" : "876000h";
  const compensationDuration = parsed.data.isActive ? "876000h" : "none";
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.profileId, {
    ban_duration: banDuration,
  });

  if (authError) {
    redirectToUsers(locale, "error", "request_failed");
  }

  const supabase = await createClient();
  const { error: databaseError } = await supabase.rpc("set_account_active", {
    p_is_active: parsed.data.isActive,
    p_profile_id: parsed.data.profileId,
  });

  if (databaseError) {
    await admin.auth.admin.updateUserById(parsed.data.profileId, {
      ban_duration: compensationDuration,
    });
    const code = databaseError.message.includes("admin_cannot_disable_self")
      ? "cannot_disable_self"
      : "request_failed";
    redirectToUsers(locale, "error", code);
  }

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit`);
  redirectToUsers(locale, "status", parsed.data.isActive ? "activated" : "disabled");
}
