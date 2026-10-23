import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

const protectedSections = [
  "finance",
  "exams",
  "certificates",
  "reports",
  "announcements",
  "templates",
] as const;

test("P7-P10 administration workflows render and advanced reports reach their data source", async ({
  page,
}) => {
  await signInAs(page, "en", "admin");

  for (const section of protectedSections) {
    await page.goto(`/en/admin/${section}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main#main-content")).not.toContainText("not available");
  }

  for (const reportType of ["students", "finance", "interventions"] as const) {
    const response = await page.request.get(
      `/api/admin/reports/advanced?reportType=${reportType}&locale=en&from=2026-01-01&to=2026-12-31&page=1&pageSize=10&timezone=Africa%2FCairo`,
    );
    expect(response.status(), `${reportType} report response`).toBe(200);
    const body = (await response.json()) as {
      report_type: string;
      rows: unknown[];
      total: number;
    };
    expect(body.report_type).toBe(reportType);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  }
});

for (const locale of ["ar", "en"] as const) {
  test(`P10 intervention center is keyboard reachable at 360px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await signInAs(page, locale, "admin");
    await page.goto(`/${locale}/admin/control-center`);

    await expect(page.locator("#intervention-title")).toBeVisible();
    const status = page.locator("#caseStatus");
    const priority = page.locator("#casePriority");
    await status.focus();
    await expect(status).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(priority).toBeFocused();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("P10 advanced reports reject unauthenticated access", async ({ browser }) => {
  const context = await browser.newContext();
  const response = await context.request.get(
    "/api/admin/reports/advanced?reportType=students&locale=en&from=2026-01-01&to=2026-12-31",
    { maxRedirects: 0 },
  );
  expect([302, 303, 307, 308, 401, 403]).toContain(response.status());
  await context.close();
});
