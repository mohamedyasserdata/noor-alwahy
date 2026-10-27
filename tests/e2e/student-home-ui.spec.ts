import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers/auth";

for (const locale of [
  { code: "ar", direction: "rtl", title: "حصتك القادمة" },
  { code: "en", direction: "ltr", title: "Your next session" },
] as const) {
  test(`${locale.code} student home uses the dedicated top navigation and visual system`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1680, height: 945 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await signInAs(page, locale.code, "student");
    await page.goto(`/${locale.code}/student/home`);

    await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
    await expect(page.getByTestId("student-portal-header")).toBeVisible();
    await expect(page.getByTestId("portal-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("portal-bottom-nav")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: locale.title })).toBeVisible();
    const topNavigation = page.getByTestId("portal-navigation-top").filter({ visible: true });
    await expect(topNavigation).toBeVisible();
    await expect(topNavigation.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator(".student-home section").first()).toHaveCSS(
      "background-image",
      /golden-quran-sunlit-mosque\.png/,
    );
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("student-portal-header")).toBeVisible();
    await expect(page.getByTestId("portal-navigation-top").filter({ visible: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
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
    .locator(
      "header a:visible, header button:visible, header summary:visible, main a:visible, main button:visible",
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { height: rect.height, label: element.textContent?.trim(), width: rect.width };
        })
        .filter(({ height, width }) => width < 44 || height < 44),
    );

  expect(undersizedTargets).toEqual([]);
}
