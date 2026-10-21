import { describe, expect, it } from "vitest";

import { publicApplicationSchema } from "../../lib/validators/applications";

const valid = {
  locale: "en",
  student_name: "Test Student",
  student_gender: "male",
  student_age: 12,
  guardian_name: "Test Guardian",
  contact_email: "family@example.test",
  contact_phone: "",
  country_code: "EG",
  timezone: "Africa/Cairo",
  track_id: "",
  package_id: "",
  self_level: "beginner",
  preferred_times: ["Sunday 18:00"],
  preferred_teacher_gender: "male",
  notes: "",
  consent: true,
  captcha_token: "local-e2e-recaptcha-token",
  source: "website",
} as const;

describe("public application validation", () => {
  it("accepts a complete application", () =>
    expect(publicApplicationSchema.safeParse(valid).success).toBe(true));
  it("requires guardian details for minors", () =>
    expect(publicApplicationSchema.safeParse({ ...valid, guardian_name: "" }).success).toBe(false));
  it("requires one contact method", () =>
    expect(
      publicApplicationSchema.safeParse({ ...valid, contact_email: "", contact_phone: "" }).success,
    ).toBe(false));
  it("enforces teacher preference against student gender", () =>
    expect(
      publicApplicationSchema.safeParse({ ...valid, preferred_teacher_gender: "female" }).success,
    ).toBe(false));
});
