import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { getPublicSupabaseEnv } from "@/lib/env";

export async function updateSession(request: NextRequest, createResponse: () => NextResponse) {
  const env = getPublicSupabaseEnv();
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];
  const pendingHeaders = new Headers();
  const supabase = createServerClient(
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

  // This verified call also refreshes an expired token before the response is
  // committed. Authorization checks still use getUser() per the constitution.
  await supabase.auth.getClaims();

  // Build the routing response after a possible refresh so next-intl forwards
  // the updated request cookies to the Server Component in this same request.
  const response = createResponse();
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  pendingHeaders.forEach((value, name) => {
    response.headers.set(name, value);
  });

  return response;
}
