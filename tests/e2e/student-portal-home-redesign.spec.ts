import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

for (const viewport of viewports) {
  test(`student home visual shell works at ${viewport.name}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize(viewport);
    await signInAs(page, "ar", "student");
    await page.goto("/ar/student/home");

    await expect(page.getByTestId("student-portal-header")).toBeVisible();
    await expect(page.getByTestId("portal-sidebar")).toBeHidden();
    await expect(page.getByTestId("portal-bottom-nav")).toBeHidden();
    await expect(
      page.getByTestId("portal-navigation-top").locator('a[aria-current="page"]'),
    ).toHaveText("الرئيسية");
    await expect(page.getByRole("heading", { level: 1, name: "حصتك القادمة" })).toBeVisible();

    const hero = page.locator('img[src*="hero-quran"]');
    await expect(hero).toBeVisible();
    expect(await hero.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    for (const label of ["التقدّم", "الجدول", "الشهادات", "التواصل"]) {
      await expect(page.getByRole("link", { name: `فتح قسم ${label}` })).toBeVisible();
    }

    const pageWidth = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.document).toBe(pageWidth.viewport);

    await page.screenshot({
      path: `output/playwright/student-home-ar-${viewport.name}.png`,
      fullPage: true,
    });
  });
}
