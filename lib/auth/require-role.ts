import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

import { getRoleHome, type UserRole } from "./roles";

async function requireActiveIdentity(locale: AppLocale) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/auth/login?reason=authentication_required`);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || !profile.is_active) {
    redirect(`/${locale}/auth/login?reason=account_unavailable`);
  }

  return { profile, supabase, user };
}

export async function requireRole(requiredRole: UserRole, locale: AppLocale) {
  const identity = await requireActiveIdentity(locale);

  if (identity.profile.role !== requiredRole) {
    redirect(getRoleHome(identity.profile.role, locale) as Route);
  }

  if (requiredRole === "admin") {
    const { data, error } = await identity.supabase.auth.getClaims();

    if (error || data?.claims.aal !== "aal2") {
      redirect(`/${locale}/auth/mfa` as Route);
    }
  }

  return { profile: identity.profile, user: identity.user };
}

export async function requireAdminMfaEntry(locale: AppLocale) {
  const identity = await requireActiveIdentity(locale);

  if (identity.profile.role !== "admin") {
    redirect(getRoleHome(identity.profile.role, locale) as Route);
  }

  const { data, error } = await identity.supabase.auth.getClaims();

  if (!error && data?.claims.aal === "aal2") {
    redirect(`/${locale}/admin/dashboard` as Route);
  }

  return identity;
}
