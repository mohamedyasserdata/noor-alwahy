import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  return updateSession(request, () => {
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");

    if (isApiRoute) {
      return NextResponse.next({ request: { headers: request.headers } });
    }

    return handleI18nRouting(request);
  });
}

export const config = {
  matcher: "/((?!trpc|_next|_vercel|.*\\..*).*)",
};
