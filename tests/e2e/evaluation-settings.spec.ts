import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

async function fillThresholds(page: Parameters<typeof signInAs>[0], values: number[]) {
  for (const [index, value] of values.entries()) {
    await page.getByTestId(`evaluation-threshold-${index}`).fill(String(value));
  }
}

test("US-096 admin atomically updates evaluation weights, deductions, and thresholds", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await signInAs(page, "en", "admin");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/admin/evaluation?sessionType=recitation");
  await expect(
    page.getByRole("heading", { level: 1, name: "Evaluation weights and deductions" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Recitation and correction" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByTestId("evaluation-weight-fluency").fill("2");
  await page.getByTestId("evaluation-dMajor").fill("3");
  await fillThresholds(page, [0, 25, 50, 75, 90]);
  await page.getByRole("button", { name: "Save this session type" }).click();

  await expect(page).toHaveURL(
    /\/en\/admin\/evaluation\?sessionType=recitation&evaluationStatus=updated$/,
  );
  await expect(
    page.getByText("The session type weights, deductions, and thresholds were saved."),
  ).toBeVisible();
  await expect(page.getByTestId("evaluation-weight-fluency")).toHaveValue("2");
  await expect(page.getByTestId("evaluation-dMajor")).toHaveValue("3");
  await expect(page.getByTestId("evaluation-threshold-1")).toHaveValue("25");

  const weightInputs = page.locator('[data-testid^="evaluation-weight-"]');
  for (let index = 0; index < (await weightInputs.count()); index += 1) {
    await weightInputs.nth(index).fill("0");
  }
  await page.getByRole("button", { name: "Save this session type" }).click();
  await expect(page).toHaveURL(
    /\/en\/admin\/evaluation\?sessionType=recitation&evaluationError=invalid_fields$/,
  );
  await expect(page.getByText(/weight total must be greater than zero/i)).toBeVisible();
  await expect(page.getByTestId("evaluation-weight-fluency")).toHaveValue("2");

  await page.getByTestId("evaluation-weight-fluency").fill("1");
  await page.getByTestId("evaluation-dMajor").fill("2");
  await fillThresholds(page, [0, 30, 50, 70, 90]);
  await page.getByRole("button", { name: "Save this session type" }).click();
  await expect(page).toHaveURL(/evaluationStatus=updated$/);

  await page.goto("/ar/admin/evaluation?sessionType=recitation");
  await expect(
    page.getByRole("heading", { level: 1, name: "أوزان وخصومات التقييم" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "تلاوة وتصحيح" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
