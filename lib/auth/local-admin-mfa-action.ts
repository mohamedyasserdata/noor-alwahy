"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { isLocalAdminMfaHelperAvailable } from "./local-admin-mfa";
import { generateTotp, isLocalFixtureAdmin } from "./local-admin-mfa-policy";

export type LocalAdminMfaResult = { ok: true } | { ok: false };

export async function completeLocalAdminMfa(): Promise<LocalAdminMfaResult> {
  if (!(await isLocalAdminMfaHelperAvailable())) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isLocalFixtureAdmin(user)) return { ok: false };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin" || !profile.is_active) return { ok: false };

  const admin = createAdminClient();
  const { data: existing, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: user.id,
  });

  if (listError) return { ok: false };

  for (const factor of existing.factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: user.id,
    });
    if (error) return { ok: false };
  }

  const { data: enrollment, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Noor Al-Wahy Local Development",
  });

  if (enrollError) return { ok: false };

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: enrollment.id,
    code: generateTotp(enrollment.totp.secret),
  });

  if (verifyError) return { ok: false };

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  return !claimsError && claims?.claims.aal === "aal2" ? { ok: true } : { ok: false };
}
