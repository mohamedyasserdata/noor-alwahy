import { expect, type Page } from "@playwright/test";

import { generateTotp } from "./totp";

export const testAccounts = {
  admin: { email: "admin.test@noor.local", home: "/admin/dashboard" },
  teacher: { email: "teacher.test@noor.local", home: "/teacher/today" },
  student: { email: "student.test@noor.local", home: "/student/home" },
  parent: { email: "parent.test@noor.local", home: "/parent/home" },
  recovery: { email: "recovery.test@noor.local", home: "/student/home" },
} as const;

export type TestAccount = keyof typeof testAccounts;

export async function signInAs(page: Page, locale: "ar" | "en", account: TestAccount) {
  await page.context().clearCookies();
  await page.goto(`/${locale}/auth/login`);
  await page.locator("#email").fill(testAccounts[account].email);
  await page.locator("#password").fill("AcademyTest1!");
  await page.locator('button[type="submit"]').click();

  if (account === "admin") {
    const secret = process.env.E2E_ADMIN_TOTP_SECRET;
    if (!secret) throw new Error("Missing the runtime Playwright administrator TOTP secret.");
    await expect(page.locator("#mfa-code")).toBeVisible();
    await page.locator("#mfa-code").fill(generateTotp(secret));
    await page
      .locator("form")
      .filter({ has: page.locator("#mfa-code") })
      .locator('button[type="submit"]')
      .click();
  }

  await expect(page).toHaveURL(new RegExp(`/${locale}${testAccounts[account].home}(?:\\?.*)?$`));
}
