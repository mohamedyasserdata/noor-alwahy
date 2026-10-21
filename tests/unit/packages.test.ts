import { describe, expect, it } from "vitest";

import { packageWizardSchema } from "../../lib/validators/packages";

const validPackage = {
  package_id: "",
  slug: "foundation-monthly",
  track_id: "",
  name_ar: "باقة التأسيس",
  name_en: "Foundation package",
  description_ar: "باقة تأسيس متكاملة",
  description_en: "A complete foundation package",
  audience: "child",
  teacher_gender: "",
  sessions_per_week: 3,
  duration_min: 30,
  billing_period: "monthly",
  features: [{ ar: "تقارير أسبوعية", en: "Weekly reports", icon: "star" }],
  policy: {
    cancel_notice_hours: 12,
    max_makeups_per_period: 2,
    makeup_valid_days: 30,
    late_tolerance_min: 10,
    student_no_show_consumes_credit: true,
    student_no_show_pays_teacher: true,
    partial_refund_pct: 0,
    max_pause_days: 30,
    trial: { enabled: true, price_pct: 0 },
  },
  prices: [
    {
      country_code: "ZZ",
      currency: "USD",
      amount: "45",
      min_amount: "20",
      max_amount: "100",
      is_active: true,
      valid_from: "2026-10-21T00:00:00.000Z",
    },
  ],
  is_published: true,
} as const;

describe("package wizard validation", () => {
  it("accepts a complete publishable package", () => {
    expect(packageWizardSchema.safeParse(validPackage).success).toBe(true);
  });

  it("requires an active rest-of-world price before publication", () => {
    const result = packageWizardSchema.safeParse({
      ...validPackage,
      prices: [{ ...validPackage.prices[0], country_code: "EG", currency: "EGP" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate country prices and prices outside their bounds", () => {
    const duplicate = packageWizardSchema.safeParse({
      ...validPackage,
      prices: [validPackage.prices[0], validPackage.prices[0]],
    });
    const outsideBounds = packageWizardSchema.safeParse({
      ...validPackage,
      prices: [{ ...validPackage.prices[0], amount: "10" }],
    });
    expect(duplicate.success).toBe(false);
    expect(outsideBounds.success).toBe(false);
  });
});
