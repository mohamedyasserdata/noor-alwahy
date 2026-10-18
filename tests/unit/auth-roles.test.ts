import { describe, expect, it } from "vitest";

import {
  getRoleHome,
  getSafeLocalizedPath,
  getPortalRoleFromPath,
  parseUserRole,
} from "../../lib/auth/roles";

describe("authentication role routing", () => {
  it.each([
    ["admin", "/ar/admin/dashboard"],
    ["teacher", "/ar/teacher/today"],
    ["student", "/ar/student/home"],
    ["parent", "/ar/parent/children"],
  ] as const)("routes %s to its Arabic portal", (role, expected) => {
    expect(getRoleHome(role, "ar")).toBe(expected);
  });

  it("parses only supported roles", () => {
    expect(parseUserRole("teacher")).toBe("teacher");
    expect(parseUserRole("owner")).toBeNull();
    expect(parseUserRole(undefined)).toBeNull();
  });

  it("recognizes protected portal paths", () => {
    expect(getPortalRoleFromPath("/en/admin/audit")).toEqual({ locale: "en", role: "admin" });
    expect(getPortalRoleFromPath("/ar/auth/login")).toBeNull();
  });

  it("accepts localized internal destinations and rejects open redirects", () => {
    expect(getSafeLocalizedPath("/en/student/home?tab=progress", "en")).toBe(
      "/en/student/home?tab=progress",
    );
    expect(getSafeLocalizedPath("https://example.com", "en")).toBe("/en/auth/login");
    expect(getSafeLocalizedPath("//example.com", "ar")).toBe("/ar/auth/login");
    expect(getSafeLocalizedPath("/en/../admin", "en")).toBe("/en/auth/login");
  });
});
