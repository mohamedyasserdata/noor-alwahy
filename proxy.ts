import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { getPortalRoleFromPath, getRoleHome, parseUserRole } from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  return updateSession(request, (claims) => {
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");

    if (isApiRoute) {
      return NextResponse.next({ request: { headers: request.headers } });
    }

    const protectedPortal = getPortalRoleFromPath(pathname);
    const role = parseUserRole(claims?.app_metadata?.role);

    if (protectedPortal && !claims) {
      const loginUrl = new URL(`/${protectedPortal.locale}/auth/login`, request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    if (protectedPortal && role && role !== protectedPortal.role) {
      return NextResponse.redirect(new URL(getRoleHome(role, protectedPortal.locale), request.url));
    }

    if (protectedPortal?.role === "admin" && role === "admin" && claims?.aal !== "aal2") {
      const mfaUrl = new URL(`/${protectedPortal.locale}/auth/mfa`, request.url);
      mfaUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(mfaUrl);
    }

    const loginMatch = pathname.match(/^\/(ar|en)\/auth\/login\/?$/);

    if (loginMatch && role) {
      if (role === "admin" && claims?.aal !== "aal2") {
        return NextResponse.redirect(new URL(`/${loginMatch[1]}/auth/mfa`, request.url));
      }

      return NextResponse.redirect(
        new URL(getRoleHome(role, loginMatch[1] as (typeof routing.locales)[number]), request.url),
      );
    }

    return handleI18nRouting(request);
  });
}

export const config = {
  matcher: "/((?!trpc|_next|_vercel|.*\\..*).*)",
};
