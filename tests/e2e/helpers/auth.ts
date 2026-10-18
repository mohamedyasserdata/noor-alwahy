import { expect, type Page } from "@playwright/test";

export const testAccounts = {
  admin: { email: "admin.test@noor.local", home: "/admin/dashboard" },
  teacher: { email: "teacher.test@noor.local", home: "/teacher/today" },
  student: { email: "student.test@noor.local", home: "/student/home" },
  parent: { email: "parent.test@noor.local", home: "/parent/children" },
  recovery: { email: "recovery.test@noor.local", home: "/student/home" },
} as const;

export type TestAccount = keyof typeof testAccounts;

export async function signInAs(page: Page, locale: "ar" | "en", account: TestAccount) {
  await page.context().clearCookies();
  await page.goto(`/${locale}/auth/login`);
  await page.locator("#email").fill(testAccounts[account].email);
  await page.locator("#password").fill("AcademyTest1!");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}${testAccounts[account].home}(?:\\?.*)?$`));
}
