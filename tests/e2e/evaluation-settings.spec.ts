import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("US-096 admin updates one session evaluation policy atomically", async ({ page }) => {
  test.setTimeout(90_000);

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/settings#evaluation-settings");
  await expect(
    page.getByRole("heading", { level: 2, name: "Evaluation weights and deductions" }),
  ).toBeVisible();

  const form = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "New memorization" }) });
  await expect(form).toBeVisible();
  await form.locator("#new_memo-memorization").fill("2");
  await form.locator("#new_memo-major").fill("3");
  await form.locator("#new_memo-threshold-1").fill("25");
  await form.getByRole("button", { name: "Save session settings" }).click();

  await expect(page).toHaveURL(
    /evaluationStatus=updated&evaluationSession=new_memo#evaluation-settings$/,
  );
  await expect(page.getByText("The settings for New memorization were updated.")).toBeVisible();
  await expect(page.locator("#new_memo-memorization")).toHaveValue("2");
  await expect(page.locator("#new_memo-major")).toHaveValue("3");
  await expect(page.locator("#new_memo-threshold-1")).toHaveValue("25");

  await page.goto("/en/admin/audit?table=eval_weights");
  await expect(page.locator("table").getByText("Updated", { exact: true }).first()).toBeVisible();

  await page.goto("/en/admin/settings#evaluation-settings");
  const restoreForm = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "New memorization" }) });
  const weightInputs = restoreForm.locator('input[name^="weight:"]');
  for (let index = 0; index < (await weightInputs.count()); index += 1) {
    await weightInputs.nth(index).fill("1");
  }
  await restoreForm.locator("#new_memo-major").fill("2");
  await restoreForm.locator("#new_memo-minor").fill("0.5");
  await restoreForm.locator("#new_memo-prompt").fill("0.5");
  await restoreForm.locator("#new_memo-forgot").fill("1");
  for (const [index, threshold] of [0, 30, 50, 70, 90].entries()) {
    await restoreForm.locator(`#new_memo-threshold-${index}`).fill(String(threshold));
  }
  await restoreForm.getByRole("button", { name: "Save session settings" }).click();
  await expect(page.getByText("The settings for New memorization were updated.")).toBeVisible();
});
