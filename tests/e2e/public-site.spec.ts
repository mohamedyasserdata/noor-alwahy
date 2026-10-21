import { expect, test } from "@playwright/test";

const locales = [
  { code: "ar", direction: "rtl", other: "en" },
  { code: "en", direction: "ltr", other: "ar" },
] as const;
const viewports = [
  { name: "mobile", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
] as const;
const publicPaths = ["", "/tracks", "/faq", "/contact"] as const;

for (const locale of locales) {
  for (const viewport of viewports) {
    test(`${locale.code} public site stays accessible at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);

      for (const path of publicPaths) {
        await page.goto(`/${locale.code}${path}`);
        await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
        await expect(page.locator("main#main-content")).toBeVisible();
        await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);

        const dimensions = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBe(dimensions.innerWidth);
      }

      await page.goto(`/${locale.code}/tracks?source=public-test`);
      await page.locator(`nav a[lang="${locale.other}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${locale.other}/tracks\\?source=public-test$`));
    });
  }
}
