import { describe, expect, it } from "vitest";

import {
  localPricingAccessKey,
  matchesPricingAccessKey,
  resolvePricingAccessKey,
} from "../../lib/public-site/pricing-access-policy";

describe("private pricing access", () => {
  it("uses a fixed local preview only during development", () => {
    expect(resolvePricingAccessKey(undefined, "development")).toBe(localPricingAccessKey);
    expect(resolvePricingAccessKey(undefined, "production")).toBeNull();
  });

  it("requires a strong configured key in every environment", () => {
    const key = "customer_offer_8rC5Wq2nK7mP9xZ4";
    expect(resolvePricingAccessKey(key, "production")).toBe(key);
    expect(resolvePricingAccessKey("short-key", "production")).toBeNull();
  });

  it("matches only the complete access key", () => {
    const key = "customer_offer_8rC5Wq2nK7mP9xZ4";
    expect(matchesPricingAccessKey(key, key)).toBe(true);
    expect(matchesPricingAccessKey(`${key}x`, key)).toBe(false);
    expect(matchesPricingAccessKey("", key)).toBe(false);
  });
});
