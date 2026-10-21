import "server-only";

import { createHmac } from "node:crypto";

const LOCAL_CAPTCHA_TOKEN = "local-e2e-recaptcha-token";

export function applicationHash(value: string) {
  const pepper =
    process.env.APPLICATION_LOOKUP_PEPPER ??
    (process.env.NODE_ENV === "production" ? "" : "local-only-application-pepper");
  if (!pepper) throw new Error("application_lookup_pepper_missing");
  return createHmac("sha256", pepper).update(value.trim().toLowerCase()).digest("hex");
}

export function requesterIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
    .trim()
    .slice(0, 100);
}

export function lookupIdentifier(email: string, phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4
    ? { value: digits.slice(-4), hint: "phone_last4" as const }
    : { value: email.trim().toLowerCase(), hint: "email" as const };
}

export async function verifyApplicationCaptcha(token: string, ip: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) return process.env.NODE_ENV !== "production" && token === LOCAL_CAPTCHA_TOKEN;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean; score?: number; action?: string };
  return result.success === true && result.action === "apply" && (result.score ?? 0) >= 0.5;
}
