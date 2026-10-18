import { createClient } from "@supabase/supabase-js";

import { generateTotp } from "./helpers/totp";

const adminUserId = "10000000-0000-4000-8000-000000000001";

export default async function globalSetup() {
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const publicKey = requireEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const authOptions = {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  } as const;
  const admin = createClient(url, serviceKey, authOptions);
  const { data: existing, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: adminUserId,
  });

  if (listError) throw listError;

  for (const factor of existing.factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: adminUserId,
    });
    if (error) throw error;
  }

  const client = createClient(url, publicKey, authOptions);
  const { error: signInError } = await client.auth.signInWithPassword({
    email: "admin.test@noor.local",
    password: "AcademyTest1!",
  });
  if (signInError) throw signInError;

  const { data: enrollment, error: enrollError } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Playwright Admin",
  });
  if (enrollError) throw enrollError;

  const secret = enrollment.totp.secret;
  const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
    factorId: enrollment.id,
    code: generateTotp(secret),
  });
  if (verifyError) throw verifyError;

  process.env.E2E_ADMIN_TOTP_SECRET = secret;
  await client.auth.signOut();
}

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} for Playwright global setup.`);
  return value;
}
