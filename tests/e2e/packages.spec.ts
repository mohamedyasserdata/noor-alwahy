import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("P6 administrator creates, previews, exports, and atomically reimports a package", async ({
  page,
}) => {
  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/packages/wizard");

  await page.getByLabel("Arabic package name").fill("باقة التأسيس الشاملة");
  await page.getByLabel("English package name").fill("Complete foundation");
  await page.getByLabel("URL slug").fill("complete-foundation");
  await page.getByLabel("Arabic description").fill("برنامج تأسيس منظم ومتكامل");
  await page.getByLabel("English description").fill("A complete and structured foundation program");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Price").fill("45");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Add feature" }).click();
  await page.getByLabel("Arabic feature").fill("تقارير أسبوعية");
  await page.getByLabel("English feature").fill("Weekly reports");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Complete foundation", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Publish immediately after saving").check();
  await page.getByRole("button", { name: "Save package" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/packages\?packageStatus=published$/);
  await expect(page.getByText("Complete foundation", { exact: true })).toBeVisible();

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
  await expect(page.getByText("Preview ready: 1 packages")).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page).toHaveURL(/packageStatus=imported&count=1$/);

  await page.getByRole("button", { name: "Clone", exact: true }).click();
  await expect(page).toHaveURL(/packageStatus=cloned$/);
  await expect(page.getByText("Complete foundation (Copy)", { exact: true })).toBeVisible();
});
