"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { getRoleHome, parseUserRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from "@/lib/validators/auth";

import { routing, type AppLocale } from "../../i18n/routing";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function redirectToAuth(locale: AppLocale, route: string, key: string, value: string): never {
  const query = new URLSearchParams({ [key]: value });
  redirect(`/${locale}/auth/${route}?${query.toString()}` as Route);
}

export async function loginAction(localeValue: string, formData: FormData): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirectToAuth(locale, "login", "error", "invalid_fields");
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);

  if (signInError) {
    redirectToAuth(locale, "login", "error", "invalid_credentials");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectToAuth(locale, "login", "error", "invalid_credentials");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  const role = parseUserRole(profile?.role);

  if (!role || !profile?.is_active) {
    await supabase.auth.signOut();
    redirectToAuth(locale, "login", "reason", "account_unavailable");
  }

  redirect(getRoleHome(role, locale) as Route);
}

export async function forgotPasswordAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirectToAuth(locale, "forgot-password", "error", "invalid_email");
  }

  const requestHeaders = await headers();
  const originValue = requestHeaders.get("origin");

  if (!originValue) {
    redirectToAuth(locale, "forgot-password", "error", "request_failed");
  }

  const origin = new URL(originValue).origin;
  const callback = new URL(`/${locale}/auth/callback`, origin);
  callback.searchParams.set("next", `/${locale}/auth/reset-password`);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callback.toString(),
  });

  if (error) {
    redirectToAuth(locale, "forgot-password", "error", "request_failed");
  }

  redirectToAuth(locale, "forgot-password", "status", "sent");
}

export async function resetPasswordAction(localeValue: string, formData: FormData): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    redirectToAuth(locale, "reset-password", "error", "invalid_password");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectToAuth(locale, "forgot-password", "error", "expired_link");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirectToAuth(locale, "reset-password", "error", "request_failed");
  }

  await supabase.auth.signOut();
  redirectToAuth(locale, "login", "status", "password_updated");
}
