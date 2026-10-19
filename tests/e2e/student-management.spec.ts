import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("US-011 to US-013 admin manages and exports an audited student record", async ({ page }) => {
  test.setTimeout(90_000);
  const name = "Student Directory E2E";
  const updatedName = "Student Directory E2E Updated";

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/students");
  await expect(page.getByRole("heading", { level: 1, name: "Students" })).toBeVisible();

  await page.locator("#student-name").fill(name);
  await page.locator("#student-gender").selectOption("female");
  await page.locator("#student-birth").fill("2014-05-10");
  await page.locator("#student-joined").fill("2026-10-19");
  await page.locator("#student-country-edit").fill("EG");
  await page.locator("#student-health").fill("Private E2E health note");
  await page.locator("#student-special").fill("Private E2E special note");
  await page.getByRole("button", { name: "Add student" }).click();

  await expect(page).toHaveURL(/studentStatus=created$/);
  await expect(page.getByText("The student was added successfully.")).toBeVisible();
  const row = page.locator("li").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Open profile" }).click();

  await expect(page.getByRole("heading", { name: `Profile: ${name}` })).toBeVisible();
  await expect(page.locator("#student-health")).toHaveValue("Private E2E health note");
  await page.locator("#student-name").fill(updatedName);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(/studentStatus=updated$/);
  await expect(page.getByText("The student was updated successfully.")).toBeVisible();
  await page.locator("#student-search").fill(updatedName);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText(updatedName, { exact: true })).toBeVisible();

  const exportResponse = await page.request.get(
    `/en/admin/students/export?q=${encodeURIComponent(updatedName)}`,
  );
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-type"]).toContain("text/csv");
  expect(await exportResponse.text()).toContain(updatedName);

  const updatedRow = page.locator("li").filter({ hasText: updatedName });
  await updatedRow.getByRole("button", { name: "Archive" }).click();
  await expect(page).toHaveURL(/studentStatus=archived$/);
  await expect(page.getByText("The student was archived successfully.")).toBeVisible();
  await page.locator("#student-status").selectOption("archived");
  await page.locator("#student-search").fill(updatedName);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator("li").filter({ hasText: updatedName })).toContainText("Archived");
});
