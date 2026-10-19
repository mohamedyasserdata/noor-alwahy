import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("US-073 teacher saves an approved Zoom link in under 15 seconds", async ({ page }) => {
  const db = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    },
  );
  const { data: existing } = await db
    .from("teachers")
    .select("id")
    .eq("profile_id", "10000000-0000-4000-8000-000000000002")
    .maybeSingle();
  if (!existing) {
    const { error } = await db.from("teachers").insert({
      profile_id: "10000000-0000-4000-8000-000000000002",
      gender: "male",
      status: "pending",
    });
    if (error) throw error;
  }

  await signInAs(page, "en", "teacher");
  await page.goto("/en/teacher/zoom");
  const field = page.locator("#teacher-zoom-url");
  await field.fill("https://zoom.us.evil.test/j/123");
  await page.getByRole("button", { name: "Save link" }).click();
  await expect(page).toHaveURL(/zoomError=invalid_url$/);
  await expect(page.getByText("Enter an HTTPS URL on an approved Zoom host.")).toBeVisible();

  const startedAt = Date.now();
  await field.fill("https://academy.zoom.us/j/123456789");
  await page.getByRole("button", { name: "Save link" }).click();
  await expect(page).toHaveURL(/zoomStatus=saved$/);
  await expect(page.getByText("Zoom link saved.")).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(15_000);
  await expect(field).toHaveValue("https://academy.zoom.us/j/123456789");
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
