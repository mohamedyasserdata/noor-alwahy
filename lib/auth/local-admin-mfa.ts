import "server-only";

import { headers } from "next/headers";

import { getPublicSupabaseEnv } from "@/lib/env";
import { isLocalAdminMfaEnvironment } from "@/lib/auth/local-admin-mfa-policy";

export async function isLocalAdminMfaHelperAvailable() {
  const requestHeaders = await headers();

  return isLocalAdminMfaEnvironment({
    host: requestHeaders.get("host"),
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_URL,
  });
}
