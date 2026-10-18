import { describe, expect, it } from "vitest";

import {
  academyProfileSchema,
  publicAppSettingsSchema,
  supportHoursSchema,
} from "../../lib/validators/app-settings";

const validAcademyProfile = {
  nameAr: "أكاديمية نور الوحي",
  nameEn: "Noor Al-Wahy Academy",
  descriptionAr: "تعليم قرآني منظم بمتابعة آمنة وواضحة.",
  descriptionEn: "Structured Quran learning with safe, clear follow-up.",
  logoPath: "/images/academy-logo.svg",
};

const validSupportHours = {
  ar: "تكون الاستجابة خلال مواعيد العمل المعلنة للأكاديمية.",
  en: "Responses are provided during the academy's announced working hours.",
};

describe("public app settings boundaries", () => {
  it("normalizes valid bilingual settings", () => {
    const result = publicAppSettingsSchema.parse({
      academyProfile: { ...validAcademyProfile, nameEn: "  Noor Academy  " },
      supportHours: validSupportHours,
    });

    expect(result.academyProfile.nameEn).toBe("Noor Academy");
    expect(result.academyProfile.logoPath).toBe("/images/academy-logo.svg");
  });

  it("accepts a missing academy logo", () => {
    expect(academyProfileSchema.safeParse({ ...validAcademyProfile, logoPath: null }).success).toBe(
      true,
    );
  });

  it("allows only safe same-origin logo paths", () => {
    for (const logoPath of [
      "https://example.test/logo.svg",
      "//example.test/logo.svg",
      "javascript:alert(1)",
      "/images\\logo.svg",
      "/images/logo.svg\nattack",
    ]) {
      expect(academyProfileSchema.safeParse({ ...validAcademyProfile, logoPath }).success).toBe(
        false,
      );
    }
  });

  it("requires bounded bilingual values", () => {
    expect(academyProfileSchema.safeParse({ ...validAcademyProfile, nameAr: " " }).success).toBe(
      false,
    );
    expect(
      academyProfileSchema.safeParse({ ...validAcademyProfile, descriptionEn: "x".repeat(501) })
        .success,
    ).toBe(false);
    expect(supportHoursSchema.safeParse({ ...validSupportHours, en: "x" }).success).toBe(false);
  });

  it("rejects unknown fields at every settings boundary", () => {
    expect(
      academyProfileSchema.safeParse({
        ...validAcademyProfile,
        externalLogoUrl: "https://bad.test",
      }).success,
    ).toBe(false);
    expect(supportHoursSchema.safeParse({ ...validSupportHours, timezone: "UTC" }).success).toBe(
      false,
    );
    expect(
      publicAppSettingsSchema.safeParse({
        academyProfile: validAcademyProfile,
        supportHours: validSupportHours,
        internal: true,
      }).success,
    ).toBe(false);
  });
});
