import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { signInAs } from "./helpers/auth";

test("US-014 admin creates family accounts and links one parent to multiple children", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const suffix = `${testInfo.retry + 1}-${randomUUID().slice(0, 8)}`;
  const firstStudent = `Family Child One ${suffix}`;
  const secondStudent = `Family Child Two ${suffix}`;
  const studentEmail = `family.child.${suffix}@noor.local`;
  const parentEmail = `family.parent.${suffix}@noor.local`;
  const password = `FamilyPortal-${suffix}!`;
  const parentName = `Family Parent E2E ${suffix}`;

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/students");
  await createStudent(page, firstStudent, "male");
  await page
    .locator("li")
    .filter({ hasText: firstStudent })
    .getByRole("link", { name: "Open profile" })
    .click();

  const studentForm = page.locator("form").filter({ has: page.locator("#student-account-email") });
  await studentForm.locator("#student-account-email").fill(studentEmail);
  await studentForm.locator("#student-account-password").fill(password);
  await studentForm.getByRole("button", { name: "Create student account" }).click();
  await expect(page).toHaveURL(/familyStatus=student_created/);
  await expect(page.getByText("The student account was created and linked.")).toBeVisible();

  const parentForm = page.locator("form").filter({ has: page.locator("#parent-account-email") });
  await parentForm.locator("#parent-account-name").fill(parentName);
  await parentForm.locator("#parent-account-email").fill(parentEmail);
  await parentForm.locator("#parent-account-password").fill(password);
  await parentForm.locator("#new-parent-relation").fill("Parent");
  await parentForm.locator('input[name="isPrimary"]').check();
  await parentForm.locator('input[name="isPayer"]').check();
  await parentForm.getByRole("button", { name: "Create parent account" }).click();
  await expect(page).toHaveURL(/familyStatus=parent_created/);
  await expect(page.getByText("The parent account was created and linked.")).toBeVisible();
  const firstParentLink = page.locator("li").filter({ hasText: parentEmail });
  await expect(firstParentLink).toBeVisible();
  await expect(firstParentLink.getByText("Primary contact", { exact: true })).toBeVisible();
  await expect(firstParentLink.getByText("Payer", { exact: true })).toBeVisible();

  await page.goto("/en/admin/students");
  await createStudent(page, secondStudent, "female");
  await page
    .locator("li")
    .filter({ hasText: secondStudent })
    .getByRole("link", { name: "Open profile" })
    .click();

  const linkForm = page.locator("form").filter({ has: page.locator("#existing-parent") });
  await linkForm
    .locator("#existing-parent")
    .selectOption({ label: `${parentName} — ${parentEmail}` });
  await linkForm.locator("#existing-relation").fill("Parent");
  await linkForm.getByRole("button", { name: "Link parent" }).click();
  await expect(page).toHaveURL(/familyStatus=linked/);
  await expect(page.getByText("The parent was linked to this student.")).toBeVisible();
  await expect(page.getByText(parentEmail, { exact: false })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(studentEmail);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/student\/home$/);
});

async function createStudent(page: Page, fullName: string, gender: "male" | "female") {
  await page.locator("#student-name").fill(fullName);
  await page.locator("#student-gender").selectOption(gender);
  await page.locator("#student-joined").fill("2026-10-19");
  await page.getByRole("button", { name: "Add student" }).click();
  await expect(page).toHaveURL(/studentStatus=created$/);
}
