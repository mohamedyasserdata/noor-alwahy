import { describe, expect, it } from "vitest";

import {
  createManagedAccountSchema,
  setAccountActiveSchema,
} from "../../lib/validators/user-management";

describe("managed account boundaries", () => {
  it("accepts managed-role invitations including invitation-only administrators", () => {
    expect(
      createManagedAccountSchema.safeParse({
        email: "teacher@example.com",
        fullName: "Example Teacher",
        mode: "invite",
        role: "teacher",
      }).success,
    ).toBe(true);
    expect(
      createManagedAccountSchema.safeParse({
        email: "admin@example.com",
        fullName: "Example Admin",
        mode: "invite",
        role: "admin",
      }).success,
    ).toBe(true);
    expect(
      createManagedAccountSchema.safeParse({
        email: "admin@example.com",
        fullName: "Example Admin",
        mode: "password",
        role: "admin",
        temporaryPassword: "Temporary12!",
      }).success,
    ).toBe(false);
  });

  it("requires a strong temporary password for direct creation", () => {
    expect(
      createManagedAccountSchema.safeParse({
        email: "student@example.com",
        fullName: "Example Student",
        mode: "password",
        role: "student",
        temporaryPassword: "short",
      }).success,
    ).toBe(false);
    expect(
      createManagedAccountSchema.safeParse({
        email: "student@example.com",
        fullName: "Example Student",
        mode: "password",
        role: "student",
        temporaryPassword: "Temporary12!",
      }).success,
    ).toBe(true);
  });

  it("normalizes account activation booleans and rejects malformed identifiers", () => {
    expect(
      setAccountActiveSchema.parse({
        isActive: "false",
        profileId: "10000000-0000-4000-8000-000000000002",
      }).isActive,
    ).toBe(false);
    expect(
      setAccountActiveSchema.safeParse({ isActive: "true", profileId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
