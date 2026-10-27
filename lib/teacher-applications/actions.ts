"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  teacherApplicationInviteSchema,
  teacherApplicationReviewSchema,
} from "@/lib/validators/teacher-applications";

function localeOf(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(
  locale: AppLocale,
  key: "teacherApplicationError" | "teacherApplicationStatus",
  value: string,
): never {
  redirect(
    `/${locale}/admin/teacher-applications?${new URLSearchParams({ [key]: value })}` as Route,
  );
}

export async function reviewTeacherApplicationAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = localeOf(localeValue);
  const parsed = teacherApplicationReviewSchema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status"),
    internalNotes: formData.get("internalNotes"),
  });
  if (!parsed.success) go(locale, "teacherApplicationError", "invalid_fields");

  const { user } = await requireRole("admin", locale);
  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_applications")
    .update({
      status: parsed.data.status,
      internal_notes: parsed.data.internalNotes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.applicationId);

  if (error) {
    go(
      locale,
      "teacherApplicationError",
      error.message.includes("invalid_teacher_application_transition")
        ? "invalid_transition"
        : "request_failed",
    );
  }
  revalidatePath(`/${locale}/admin/teacher-applications`);
  revalidatePath(`/${locale}/admin/audit`);
  go(locale, "teacherApplicationStatus", "updated");
}

export async function inviteAcceptedTeacherAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = localeOf(localeValue);
  const parsed = teacherApplicationInviteSchema.safeParse({
    applicationId: formData.get("applicationId"),
  });
  if (!parsed.success) go(locale, "teacherApplicationError", "invalid_fields");

  const { user } = await requireRole("admin", locale);
  const supabase = await createClient();
  const { data: application, error: applicationError } = await supabase
    .from("teacher_applications")
    .select("id,status,full_name,email,gender,invited_user_id")
    .eq("id", parsed.data.applicationId)
    .maybeSingle();
  if (applicationError || !application) go(locale, "teacherApplicationError", "not_found");
  if (application.invited_user_id || application.status === "invited") {
    go(locale, "teacherApplicationError", "already_invited");
  }
  if (application.status !== "accepted") {
    go(locale, "teacherApplicationError", "accept_first");
  }

  const requestHeaders = await headers();
  const originHeader = requestHeaders.get("origin");
  if (!originHeader) go(locale, "teacherApplicationError", "request_failed");
  const callback = new URL(`/${locale}/auth/accept-invite`, new URL(originHeader).origin);

  const admin = createAdminClient();
  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    application.email,
    {
      data: {
        application_id: application.id,
        created_by: user.id,
        full_name: application.full_name,
        gender: application.gender,
        role: "teacher",
      },
      redirectTo: callback.toString(),
    },
  );
  if (inviteError || !invitation.user) {
    go(
      locale,
      "teacherApplicationError",
      /already|registered|exists/iu.test(inviteError?.message ?? "")
        ? "account_exists"
        : "invite_failed",
    );
  }

  const { error: finalizeError } = await supabase.rpc("finalize_teacher_application_invite", {
    p_application_id: application.id,
    p_profile_id: invitation.user.id,
  });
  if (finalizeError) {
    await admin.from("teachers").delete().eq("profile_id", invitation.user.id);
    await admin.from("profiles").delete().eq("id", invitation.user.id);
    await admin.auth.admin.deleteUser(invitation.user.id);
    go(locale, "teacherApplicationError", "invite_failed");
  }

  revalidatePath(`/${locale}/admin/teacher-applications`);
  revalidatePath(`/${locale}/admin/teachers`);
  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit`);
  go(locale, "teacherApplicationStatus", "invited");
}
