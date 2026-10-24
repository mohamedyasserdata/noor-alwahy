import { createHash, timingSafeEqual } from "node:crypto";

export const localPricingAccessKey = "local-pricing-preview";

export function resolvePricingAccessKey(
  configuredValue: string | undefined,
  nodeEnv: string | undefined,
) {
  const configured = configuredValue?.trim();
  if (configured && /^[A-Za-z0-9_-]{24,128}$/.test(configured)) return configured;
  return nodeEnv === "development" ? localPricingAccessKey : null;
}

export function matchesPricingAccessKey(provided: string, expected: string | null) {
  if (!expected || !/^[A-Za-z0-9_-]{16,128}$/.test(provided)) return false;

  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}
