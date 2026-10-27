import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const locales = [
  { code: "ar", direction: "rtl", title: "تواصل معنا" },
  { code: "en", direction: "ltr", title: "Contact us" },
] as const;

const viewports = [
  { name: "mobile", width: 360, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const locale of locales) {
  for (const viewport of viewports) {
    test(`${locale.code} contact page at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/${locale.code}/contact`);

      await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
      await expect(page.getByRole("heading", { level: 1, name: locale.title })).toBeVisible();
      await expect(page.locator("[data-public-contact-page]")).toBeVisible();
      await expect(page.locator("iframe")).toHaveCount(0);
      await expect(page.locator("#contact-form")).toBeVisible();
      await expect(page.locator("#contact-phone")).toBeVisible();

      const channelHrefs = await page
        .locator('[aria-labelledby="contact-channels-title"] a[href]')
        .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
      expect(new Set(channelHrefs).size).toBe(channelHrefs.length);

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      if (viewport.name === "mobile") {
        await page.locator("header summary").click();
      }
      await page.locator('[data-testid="theme-toggle"]:visible').click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
}
