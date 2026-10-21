import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("US-040 public applicant submits and checks status with a second identifier", async ({
  page,
}) => {
  await page.goto("/en/apply");
  await page.getByLabel("Student name").fill("Public Test Student");
  await page.getByLabel("Age").fill("12");
  await page.getByLabel("Guardian name (required under age 18)").fill("Public Test Guardian");
  await page.getByLabel("Email address").fill("public.application@example.test");
  await page.getByLabel("Preferred times").fill("Sunday 18:00");
  await page.getByLabel(/I agree/).check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("Your application was received")).toBeVisible();
  const order = await page.locator("p[dir=ltr]").textContent();
  expect(order).toMatch(/^NW-A-[A-F0-9]{20}$/);

  await page.getByRole("link", { name: "Track application status" }).click();
  await page.getByLabel("Application number").fill(order ?? "");
  await page.getByLabel("Email or last 4 phone digits").fill("public.application@example.test");
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(page.getByText("New application", { exact: true })).toBeVisible();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/applications?q=Public+Test+Student");
  await page.getByText("Public Test Student", { exact: true }).click();
  await page.getByLabel("Application stage").selectOption("contacted");
  await page.getByRole("button", { name: "Save stage" }).click();
  await expect(page).toHaveURL(/applicationStatus=updated$/);
  await page.getByText("Public Test Student", { exact: true }).click();
  await page.getByLabel("Application stage").selectOption("accepted");
  await page.getByRole("button", { name: "Save stage" }).click();
  await page.getByText("Public Test Student", { exact: true }).click();
  await page.getByLabel("Recitation out of 100").fill("70");
  await page.getByLabel("Tajweed out of 100").fill("75");
  await page.getByLabel("Memorization out of 100").fill("65");
  await page.getByRole("button", { name: "Save placement" }).click();
  await expect(page).toHaveURL(/applicationStatus=placement_saved$/);
  await page.getByText("Public Test Student", { exact: true }).click();
  await page.getByRole("button", { name: "Convert to student" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/students\?student=.*studentStatus=created/);
});
