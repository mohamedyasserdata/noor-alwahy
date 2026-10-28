import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

const fixtureSuffix = randomUUID().slice(0, 8);
const studentName = `Public Test Student ${fixtureSuffix}`;
const contactEmail = `public.application.${fixtureSuffix}@example.com`;

test("US-040 public applicant submits and checks status with a second identifier", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const db = databaseClient();
  const unpublishedTrackName = `Unpublished ${fixtureSuffix}`;
  const { error: unpublishedError } = await db.from("tracks").insert({
    code: `unpublished-${fixtureSuffix}`,
    name_ar: unpublishedTrackName,
    name_en: unpublishedTrackName,
    is_active: true,
  });
  if (unpublishedError) throw unpublishedError;

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/apply");
  await expect(
    page.getByRole("heading", { name: "Begin your Quran learning journey" }),
  ).toBeVisible();
  await expect(page.getByRole("option", { name: unpublishedTrackName })).toHaveCount(0);
  await page.getByLabel("Student name").fill(studentName);
  await page.getByLabel("Age", { exact: true }).fill("12");
  await page.getByLabel("Email address").fill(contactEmail);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter the guardian name for a student under 18.")).toBeVisible();
  await expect(page.getByLabel("Guardian name (required under age 18)")).toBeFocused();
  await expect(page.getByLabel("Student name")).toHaveValue(studentName);
  await page.getByLabel("Guardian name (required under age 18)").fill("Public Test Guardian");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Preferred times").fill("Sunday 18:00");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review before submission" })).toBeVisible();
  await expect(page.getByText(studentName, { exact: true })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("Your application was received")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const order = await page.getByTestId("application-order-number").textContent();
  expect(order).toMatch(/^NW-A-[A-F0-9]{20}$/);

  await page.getByRole("link", { name: "Track application status" }).click();
  await page.getByLabel("Application number").fill(order ?? "");
  await page.getByLabel("Email or last 4 phone digits").fill(contactEmail);
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(page.getByText("New application", { exact: true })).toBeVisible();

  await signInAs(page, "en", "admin");
  await page.goto(`/en/admin/applications?q=${encodeURIComponent(studentName)}`);
  const applicationCard = page.locator("details").filter({ hasText: studentName });
  await applicationCard.getByText(studentName, { exact: true }).click();
  await applicationCard.getByLabel("Application stage").selectOption("contacted");
  await applicationCard.getByRole("button", { name: "Save stage" }).click();
  await expect(page).toHaveURL(/applicationStatus=updated$/);
  await applicationCard.getByText(studentName, { exact: true }).click();
  await applicationCard.getByLabel("Application stage").selectOption("accepted");
  await applicationCard.getByRole("button", { name: "Save stage" }).click();
  await expect(
    applicationCard.locator('[data-slot="badge"]', { hasText: "Accepted" }),
  ).toBeVisible();
  await applicationCard.getByText(studentName, { exact: true }).click();
  await applicationCard.getByLabel("Recitation out of 100").fill("70");
  await applicationCard.getByLabel("Tajweed out of 100").fill("75");
  await applicationCard.getByLabel("Memorization out of 100").fill("65");
  await applicationCard.getByRole("button", { name: "Save placement" }).click();
  await expect(page).toHaveURL(/applicationStatus=placement_saved$/);
  await applicationCard.getByText(studentName, { exact: true }).click();
  await applicationCard.getByRole("button", { name: "Convert to student" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/students\?student=.*studentStatus=created/);
});

function databaseClient() {
  return createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    },
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
