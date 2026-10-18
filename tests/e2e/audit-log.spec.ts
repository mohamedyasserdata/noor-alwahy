import { expect, test, type Page } from "@playwright/test";

for (const locale of [
  {
    code: "ar",
    direction: "rtl",
    restrictedTitle: "سجل مخصص للإدارة",
    title: "سجل التدقيق",
  },
  {
    code: "en",
    direction: "ltr",
    restrictedTitle: "Administrators only",
    title: "Audit log",
  },
] as const) {
  test(`${locale.code} audit log keeps unauthenticated data private`, async ({ page }) => {
    const consoleProblems = captureConsoleProblems(page);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${locale.code}/admin/audit`);

    await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
    await expect(page.getByRole("heading", { level: 1, name: locale.title })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: locale.restrictedTitle }),
    ).toBeVisible();
    await expect(page.getByTestId("audit-log-filters")).toHaveCount(0);
    await expect(
      page.getByTestId("portal-navigation-bottom").locator('a[aria-current="page"]'),
    ).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("portal-sidebar")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(consoleProblems).toEqual([]);
  });
}

function captureConsoleProblems(page: Page) {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });

  return problems;
}

async function expectNoHorizontalOverflow(page: Page) {
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewport.scrollWidth).toBe(viewport.innerWidth);
}

async function expectTouchTargets(page: Page) {
  const undersizedTargets = await page
    .getByTestId("portal-shell-admin")
    .locator("a:visible, button:visible")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            height: rect.height,
            label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
            width: rect.width,
          };
        })
        .filter(({ height, width }) => width < 44 || height < 44),
    );

  expect(undersizedTargets).toEqual([]);
}
