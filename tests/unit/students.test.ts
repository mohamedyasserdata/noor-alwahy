import { describe, expect, it } from "vitest";

import {
  archiveStudentSchema,
  studentFiltersSchema,
  studentFormSchema,
} from "../../lib/validators/students";

const validStudent = {
  studentId: null,
  fullName: "  Ahmed Noor  ",
  gender: "male" as const,
  birthDate: "2015-03-02",
  status: "active" as const,
  levelId: null,
  joinedAt: "2026-10-19",
  countryCode: "eg",
  timezone: "Africa/Cairo",
  healthNotes: "  allergy  ",
  specialNotes: "",
  shareWithTeacher: "true" as const,
};

describe("student management boundaries", () => {
  it("normalizes a valid student form", () => {
    const result = studentFormSchema.parse(validStudent);

    expect(result.fullName).toBe("Ahmed Noor");
    expect(result.countryCode).toBe("EG");
    expect(result.healthNotes).toBe("allergy");
    expect(result.specialNotes).toBeNull();
    expect(result.shareWithTeacher).toBe(true);
  });

  it("accepts archived records without silently reactivating them", () => {
    expect(studentFormSchema.safeParse({ ...validStudent, status: "archived" }).success).toBe(true);
  });

  it("rejects invalid time zones, countries, and future birth dates", () => {
    expect(studentFormSchema.safeParse({ ...validStudent, timezone: "Cairo" }).success).toBe(false);
    expect(studentFormSchema.safeParse({ ...validStudent, countryCode: "Egypt" }).success).toBe(
      false,
    );
    expect(studentFormSchema.safeParse({ ...validStudent, birthDate: "2999-01-01" }).success).toBe(
      false,
    );
  });

  it("bounds sensitive notes and rejects malformed identifiers", () => {
    expect(
      studentFormSchema.safeParse({ ...validStudent, healthNotes: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(archiveStudentSchema.safeParse({ studentId: "not-a-uuid" }).success).toBe(false);
  });

  it("normalizes safe directory filters and rejects query abuse", () => {
    expect(studentFiltersSchema.parse({ country: "eg", page: "2" })).toMatchObject({
      country: "EG",
      page: 2,
      status: "all",
      level: "all",
    });
    expect(studentFiltersSchema.safeParse({ q: "x".repeat(81) }).success).toBe(false);
    expect(studentFiltersSchema.safeParse({ page: "0" }).success).toBe(false);
  });
});
