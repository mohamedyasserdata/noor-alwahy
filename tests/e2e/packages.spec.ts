import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { signInAs } from "./helpers/auth";

test("P6 administrator creates, previews, exports, and atomically reimports a package", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const arabicName = `باقة التأسيس الشاملة ${suffix}`;
  const englishName = `Complete foundation ${suffix}`;

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/packages/wizard");

  await page.getByLabel("Arabic package name").fill(arabicName);
  await page.getByLabel("English package name").fill(englishName);
  await page.getByLabel("URL slug").fill(`complete-foundation-${suffix}`);
  await page.getByLabel("Arabic description").fill("برنامج تأسيس منظم ومتكامل");
  await page.getByLabel("English description").fill("A complete and structured foundation program");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Price", { exact: true }).fill("45");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Add feature" }).click();
  await page.getByLabel("Arabic feature").fill("تقارير أسبوعية");
  await page.getByLabel("English feature").fill("Weekly reports");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(arabicName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Publish immediately after saving").check();
  await page.getByRole("button", { name: "Save package" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/packages\?packageStatus=published$/);
  await expect(page.getByText(englishName, { exact: true })).toBeVisible();

  const response = await page.request.get("/api/admin/packages/export?locale=en");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("spreadsheetml");
  const workbook = await response.body();

  await page.getByText("Import and export packages", { exact: true }).click();
  await page.getByLabel("Package file").setInputFiles({
    name: "packages.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook,
  });
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByText(/Preview ready: \d+ packages/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page).toHaveURL(/packageStatus=imported&count=\d+$/);

  await page
    .locator("article")
    .filter({ hasText: englishName })
    .getByRole("button", { name: "Clone", exact: true })
    .click();
  await expect(page).toHaveURL(/packageStatus=cloned$/);
  await expect(page.getByText(`${englishName} (Copy)`, { exact: true })).toBeVisible();
});
