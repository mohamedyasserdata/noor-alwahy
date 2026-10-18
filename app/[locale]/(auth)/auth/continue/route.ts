import { type NextRequest, NextResponse } from "next/server";

import { routing, type AppLocale } from "@/i18n/routing";
import { getSafeLocalizedPath } from "@/lib/auth/roles";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: localeValue } = await params;
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  const next = getSafeLocalizedPath(request.nextUrl.searchParams.get("next"), locale);

  return new NextResponse(null, { status: 303, headers: { location: next } });
}
