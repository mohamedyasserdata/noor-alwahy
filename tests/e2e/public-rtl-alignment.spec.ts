import { expect, test } from "@playwright/test";

const locales = [
  { code: "ar", direction: "rtl", alignment: "start" },
  { code: "en", direction: "ltr", alignment: "start" },
] as const;

for (const locale of locales) {
  test(`${locale.code} public hero copy follows the reading direction`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(`/${locale.code}`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
    const homeAlignment = await page
      .getByTestId("public-home-hero-copy")
      .evaluate((element) => getComputedStyle(element).textAlign);
    expect(homeAlignment).toBe(locale.alignment);

    await page.goto(`/${locale.code}/contact`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
    const contactAlignment = await page
      .getByTestId("public-contact-hero-copy")
      .evaluate((element) => getComputedStyle(element).textAlign);
    expect(contactAlignment).toBe(locale.alignment);
  });
}
