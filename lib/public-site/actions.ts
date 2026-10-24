"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { countryCodeSchema, countryCookieName } from "@/lib/public-site/country";
import { getPublicCountries } from "@/lib/public-site/packages";

export async function setCountryOverrideAction(
  localeValue: string,
  returnPathValue: string,
  formData: FormData,
) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  const parsed = countryCodeSchema.safeParse(formData.get("country"));
  const countries = await getPublicCountries();
  const country =
    parsed.success && countries.some(({ code }) => code === parsed.data) ? parsed.data : "ZZ";
  const cookieStore = await cookies();

  cookieStore.set(countryCookieName, country, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  const safeReturnPath = new RegExp(`^/${locale}/offer/[A-Za-z0-9_-]{16,128}$`).test(
    returnPathValue,
  )
    ? returnPathValue
    : `/${locale}`;
  redirect(safeReturnPath as Route);
}
