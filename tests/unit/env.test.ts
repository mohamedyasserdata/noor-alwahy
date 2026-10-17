import { afterEach, describe, expect, it } from "vitest";

import { getPublicSupabaseEnv } from "../../lib/env";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalPublicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function legacyKeyForRole(role: string) {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");

  return `header.${payload}.signature`;
}

function setPublicEnv(url: string, key: string) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
}

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  }

  if (originalPublicKey === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalPublicKey;
  }
});

describe("getPublicSupabaseEnv", () => {
  it("accepts a publishable key over HTTP for local development", () => {
    setPublicEnv("http://127.0.0.1:54321", "sb_publishable_test-key");

    expect(getPublicSupabaseEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test-key",
    });
  });

  it("accepts a legacy anon JWT", () => {
    const anonKey = legacyKeyForRole("anon");
    setPublicEnv("https://example.supabase.co", anonKey);

    expect(getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(anonKey);
  });

  it("rejects a secret key in a public variable", () => {
    setPublicEnv("https://example.supabase.co", "sb_secret_forbidden");

    expect(() => getPublicSupabaseEnv()).toThrow();
  });

  it("rejects a legacy service-role JWT in a public variable", () => {
    setPublicEnv("https://example.supabase.co", legacyKeyForRole("service_role"));

    expect(() => getPublicSupabaseEnv()).toThrow();
  });

  it("rejects non-HTTP Supabase URLs", () => {
    setPublicEnv("ftp://example.supabase.co", "sb_publishable_test-key");

    expect(() => getPublicSupabaseEnv()).toThrow();
  });
});
