import { describe, expect, it } from "vitest";

import {
  generateTotp,
  isLocalAdminMfaEnvironment,
  isLocalFixtureAdmin,
} from "../../lib/auth/local-admin-mfa-policy";

describe("local administrator MFA helper", () => {
  it("is available only for a development app and local Supabase", () => {
    expect(
      isLocalAdminMfaEnvironment({
        host: "localhost:3000",
        nodeEnv: "development",
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(true);

    expect(
      isLocalAdminMfaEnvironment({
        host: "academy.example.com",
        nodeEnv: "development",
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(false);
    expect(
      isLocalAdminMfaEnvironment({
        host: "localhost:3000",
        nodeEnv: "production",
        supabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(false);
    expect(
      isLocalAdminMfaEnvironment({
        host: "localhost:3000",
        nodeEnv: "development",
        supabaseUrl: "https://project.supabase.co",
      }),
    ).toBe(false);
  });

  it("accepts only the seeded local administrator identity", () => {
    expect(
      isLocalFixtureAdmin({
        id: "10000000-0000-4000-8000-000000000001",
        email: "admin.test@noor.local",
      }),
    ).toBe(true);
    expect(
      isLocalFixtureAdmin({
        id: "10000000-0000-4000-8000-000000000001",
        email: "another@example.com",
      }),
    ).toBe(false);
  });

  it("generates the RFC 6238 SHA-1 six-digit code", () => {
    expect(generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  });
});
