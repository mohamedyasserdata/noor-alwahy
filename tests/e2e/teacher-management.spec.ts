import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("US-060 and US-061 teacher verification, conduct and availability workflow", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/teachers");
  await expect(page.getByRole("heading", { level: 1, name: "Teacher management" })).toBeVisible();
  await page.locator("#specialization-new").fill("Quran recitation");
  await page.locator("#riwaya-new").fill("Hafs");
  await page.locator("#sanad-new").fill("Identity checked against academy records");
  await page.locator("#capacity-new").fill("12");
  await page.locator('input[name="identityVerified"]').check();
  await page.getByRole("button", { name: "Create teacher profile" }).click();
  await expect(page).toHaveURL(/teacherStatus=created$/);
  await expect(page.getByText("Teacher profile created.")).toBeVisible();

  await signInAs(page, "en", "teacher");
  await page.goto("/en/teacher/availability");
  await page.getByRole("button", { name: "Accept conduct code" }).click();
  await expect(page).toHaveURL(/availabilityStatus=conduct_accepted$/);
  await expect(page.getByText("Conduct acceptance recorded.")).toBeVisible();
  await page.locator("#availability-weekday").selectOption("2");
  await page.locator("#availability-start").fill("09:00");
  await page.locator("#availability-end").fill("10:30");
  await page.getByRole("button", { name: "Send proposal" }).click();
  await expect(page).toHaveURL(/availabilityStatus=proposed$/);
  await expect(page.getByText("Tuesday · 09:00–10:30")).toBeVisible();
  await expect(page.getByText("Awaiting review")).toBeVisible();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/teachers");
  const availability = page.locator("div.rounded-2xl").filter({ hasText: "Tuesday · 09:00–10:30" });
  await availability.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/teacherStatus=approved$/);
  const teacherCard = page.locator("article").filter({ hasText: "مدرس الاختبار" }).first();
  await teacherCard.locator('select[name="status"]').selectOption("active");
  await teacherCard.getByRole("button", { name: "Save teacher profile" }).click();
  await expect(page).toHaveURL(/teacherStatus=updated$/);
  await expect(page.getByText("Teacher profile updated.")).toBeVisible();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
});
