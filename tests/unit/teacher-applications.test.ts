import { describe, expect, it } from "vitest";

import {
  teacherApplicationQuerySchema,
  teacherApplicationReviewSchema,
  teacherApplicationSchema,
} from "../../lib/validators/teacher-applications";

const validApplication = {
  availability: "Sunday and Tuesday evenings",
  captcha_token: "local-e2e-recaptcha-token",
  consent: "on",
  email: "teacher@example.com",
  experience_years: "5",
  full_name: "Example Teacher",
  gender: "female",
  locale: "en",
  phone: "+201001234567",
  qualifications: "Certified Quran and Tajweed teacher",
  specialization: "Tajweed",
  teaching_languages: ["ar", "en"],
};

describe("teacher application boundaries", () => {
  it("accepts a complete application and normalizes numeric experience", () => {
    const parsed = teacherApplicationSchema.parse(validApplication);
    expect(parsed.experience_years).toBe(5);
    expect(parsed.email).toBe("teacher@example.com");
  });

  it("requires consent, contact details, professional details, and one language", () => {
    expect(
      teacherApplicationSchema.safeParse({ ...validApplication, consent: undefined }).success,
    ).toBe(false);
    expect(teacherApplicationSchema.safeParse({ ...validApplication, phone: "123" }).success).toBe(
      false,
    );
    expect(
      teacherApplicationSchema.safeParse({ ...validApplication, qualifications: "short" }).success,
    ).toBe(false);
    expect(
      teacherApplicationSchema.safeParse({ ...validApplication, teaching_languages: [] }).success,
    ).toBe(false);
  });

  it("limits review states and query input", () => {
    expect(
      teacherApplicationReviewSchema.safeParse({
        applicationId: "10000000-0000-4000-8000-000000000001",
        internalNotes: "Reviewed",
        status: "accepted",
      }).success,
    ).toBe(true);
    expect(
      teacherApplicationReviewSchema.safeParse({
        applicationId: "10000000-0000-4000-8000-000000000001",
        status: "invited",
      }).success,
    ).toBe(false);
    expect(teacherApplicationQuerySchema.parse({}).status).toBe("all");
  });
});
