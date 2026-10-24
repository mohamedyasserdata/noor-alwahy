import "server-only";

import {
  matchesPricingAccessKey,
  resolvePricingAccessKey,
} from "@/lib/public-site/pricing-access-policy";

export function hasPrivatePricingAccess(provided: string) {
  const expected = resolvePricingAccessKey(
    process.env.PRIVATE_PRICING_ACCESS_KEY,
    process.env.NODE_ENV,
  );

  return matchesPricingAccessKey(provided, expected);
}
