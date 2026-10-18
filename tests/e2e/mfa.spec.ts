import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { generateTotp } from "./helpers/totp";

test("US-016 blocks an AAL1 admin, enrolls TOTP, and requires it on the next sign-in", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const email = `mfa.setup.${testInfo.workerIndex}.${Date.now()}@noor.local`;
  const password = `MfaSetupTest${testInfo.retry + 1}!`;
  const admin = createServiceClient();
  const { data, error } = await admin.auth.admin.createUser({
    app_metadata: { role: "admin" },
    email,
    email_confirm: true,
    password,
    user_metadata: { full_name: "MFA Setup Admin", role: "admin" },
  });

  expect(error).toBeNull();
  expect(data.user).not.toBeNull();
  const userId = data.user!.id;

  try {
    await signIn(page, email, password);
    await expect(page.getByRole("button", { name: "Start secure setup" })).toBeVisible();

    await page.goto("/en/admin/dashboard");
    await expect(page).toHaveURL(/\/en\/auth\/mfa\?next=/);
    await page.getByRole("button", { name: "Start secure setup" }).click();
    const secret = (await page.locator("code").textContent())?.trim();
    expect(secret).toBeTruthy();
    await page.locator("#mfa-code").fill(generateTotp(secret!));
    await page.getByRole("button", { name: "Verify and open administration" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/dashboard$/);

    await page.context().clearCookies();
    await signIn(page, email, password);
    await expect(page.getByText("Enter the current six-digit code")).toBeVisible();
    await page.locator("#mfa-code").fill(generateTotp(secret!));
    await page.getByRole("button", { name: "Verify and open administration" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/dashboard$/);
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing local Supabase E2E administrator environment.");

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}
