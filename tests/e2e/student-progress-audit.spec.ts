import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("student progress explains metrics and keeps the mobile priority order", async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, "en", "student");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/student/progress");

  const goal = page.getByRole("heading", { name: /memorization plan|being prepared/i });
  const metrics = page.getByRole("heading", { name: "Your journey at a glance" });
  const required = page.getByRole("heading", { name: "Memorisation and review due" });
  const additional = page.getByText("Charts, history, and additional details", { exact: true });

  await expect(goal).toBeVisible();
  await expect(metrics).toBeVisible();
  await expect(required).toBeVisible();
  await expect(additional).toBeVisible();
  const positions = await Promise.all(
    [goal, metrics, required, additional].map(
      async (locator) => (await locator.boundingBox())?.y ?? 0,
    ),
  );
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
  await expect(page.getByText(/estimate that changes with progress speed/i)).toBeVisible();
  await expect(
    page.getByText(/Pages first mastered in the last 28 days divided by four/i),
  ).toBeHidden();
  await page.getByText("Last four weeks", { exact: true }).click();
  await expect(
    page.getByText(/Pages first mastered in the last 28 days divided by four/i),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
