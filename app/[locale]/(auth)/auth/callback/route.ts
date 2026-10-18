import { type NextRequest, NextResponse } from "next/server";

import { routing, type AppLocale } from "@/i18n/routing";
import { getSafeLocalizedPath } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

function localRedirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: localeValue } = await params;
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeLocalizedPath(request.nextUrl.searchParams.get("next"), locale);

  if (!code) {
    return localRedirect(`/${locale}/auth/forgot-password?error=expired_link`);
  }

  const continueQuery = new URLSearchParams({ next });
  const response = localRedirect(`/${locale}/auth/continue?${continueQuery.toString()}`);
  const supabase = await createClient(response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return localRedirect(`/${locale}/auth/forgot-password?error=expired_link`);
  }

  return response;
}
