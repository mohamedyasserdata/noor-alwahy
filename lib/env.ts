import { z } from "zod";

function isLegacyAnonKey(value: string) {
  const segments = value.split(".");
  const payloadSegment = segments[1];

  if (segments.length !== 3 || !payloadSegment) {
    return false;
  }

  try {
    const base64 = payloadSegment
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(base64));

    return (
      typeof payload === "object" &&
      payload !== null &&
      "role" in payload &&
      payload.role === "anon"
    );
  } catch {
    return false;
  }
}

const publicSupabaseKeySchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => /^sb_publishable_[A-Za-z0-9_-]+$/.test(value) || isLegacyAnonKey(value), {
    message:
      "Use a Supabase publishable key or a legacy anon key; secret and service-role keys are forbidden in public environment variables.",
  });

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseKeySchema,
});

export function getPublicSupabaseEnv() {
  return publicSupabaseEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
