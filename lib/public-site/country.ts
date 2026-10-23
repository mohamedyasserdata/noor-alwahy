import "server-only";

import { cookies, headers } from "next/headers";
import { z } from "zod";

export const countryCookieName = "nw_country";
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);

export async function detectVisitorCountry() {
  const cookieStore = await cookies();
  const override = countryCodeSchema.safeParse(cookieStore.get(countryCookieName)?.value);
  if (override.success) return override.data;

  const headerStore = await headers();
  const detected = countryCodeSchema.safeParse(
    headerStore.get("x-vercel-ip-country") ?? headerStore.get("cf-ipcountry") ?? "ZZ",
  );

  return detected.success ? detected.data : "ZZ";
}
