import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { getPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export type VerifiedAuthClaims = {
  aal?: string;
  app_metadata?: Record<string, unknown>;
  sub: string;
};

export async function updateSession(
  request: NextRequest,
  createResponse: (claims: VerifiedAuthClaims | null) => NextResponse,
) {
  const env = getPublicSupabaseEnv();
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];
  const pendingHeaders = new Headers();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          pendingCookies.push(...cookiesToSet);
          Object.entries(headers).forEach(([name, value]) => {
            pendingHeaders.set(name, value);
          });
        },
      },
    },
  );

  // getClaims() verifies and refreshes the token, but a correctly signed token
  // can outlive its user after a local reset or account deletion. Confirm the
  // identity with Auth before routing so middleware and Server Components do
  // not disagree and redirect the browser in a loop.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  let claims: VerifiedAuthClaims | null = null;

  if (!claimsError && claimsData?.claims) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData.user) {
      claims = claimsData.claims;
    }
  }

  // Build the routing response after a possible refresh so next-intl forwards
  // the updated request cookies to the Server Component in this same request.
  const response = createResponse(claims);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  pendingHeaders.forEach((value, name) => {
    response.headers.set(name, value);
  });

  return response;
}
