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

  if (parsed.data.mode === "invite") {
    const requestHeaders = await headers();
    const originHeader = requestHeaders.get("origin");

    if (!originHeader) {
      redirectToUsers(locale, "error", "request_failed");
    }

    const callback = new URL(`/${locale}/auth/callback`, new URL(originHeader).origin);
    callback.searchParams.set("next", `/${locale}/auth/reset-password`);
    ({ error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { ...metadata, role: parsed.data.role },
      redirectTo: callback.toString(),
    }));
  } else {
    ({ error } = await admin.auth.admin.createUser({
      app_metadata: { created_by: user.id, role: parsed.data.role },
      email: parsed.data.email,
      email_confirm: true,
      password: parsed.data.temporaryPassword,
      user_metadata: { ...metadata, role: parsed.data.role },
    }));
  }

  if (error) {
    const code = /already|registered|exists/i.test(error.message)
      ? "account_exists"
      : "request_failed";
    redirectToUsers(locale, "error", code);
  }

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
