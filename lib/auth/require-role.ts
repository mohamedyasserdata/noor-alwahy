import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

import { getRoleHome, type UserRole } from "./roles";

export async function requireRole(requiredRole: UserRole, locale: AppLocale) {
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

  if (profile.role !== requiredRole) {
    redirect(getRoleHome(profile.role, locale) as Route);
  }

  return { profile, user };
}
