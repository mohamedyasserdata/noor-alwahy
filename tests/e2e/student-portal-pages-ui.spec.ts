import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers/auth";

const pages = {
  ar: [
    { section: "progress", title: "تفاصيل تقدّم الحفظ" },
    { section: "schedule", title: "الجدول الأسبوعي" },
    { section: "billing", title: "الفواتير والمدفوعات" },
    { section: "certificates", title: "شهاداتي" },
    { section: "contact", title: "تواصل مع أكاديمية نور الوحي" },
  ],
  en: [
    { section: "progress", title: "Memorisation progress details" },
    { section: "schedule", title: "Weekly schedule" },
    { section: "billing", title: "Invoices and payments" },
    { section: "certificates", title: "My certificates" },
    { section: "contact", title: "Contact Noor Al-Wahy Academy" },
  ],
} as const;

for (const locale of ["ar", "en"] as const) {
  test(`${locale} student pages share the approved visual system`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await signInAs(page, locale, "student");

    for (const item of pages[locale]) {
      await page.goto(`/${locale}/student/${item.section}`);
      await expect(page.getByTestId("student-page-shell")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: item.title })).toBeVisible();
      await expect(page.getByTestId("portal-sidebar")).toHaveCount(0);
      await expect(
        page.getByTestId("portal-navigation-top").filter({ visible: true }),
      ).toBeVisible();
      await expect(page.getByTestId("student-page-hero")).toHaveCSS(
        "background-image",
        /golden-quran-sunlit-mosque\.png/,
      );
      await expectNoHorizontalOverflow(page);

      await page.setViewportSize({ width: 360, height: 800 });
      await expect(page.getByTestId("student-page-shell")).toBeVisible();
      await expect(page.getByTestId("portal-bottom-nav")).toBeVisible();
      await expect(page.getByTestId("portal-navigation-top").filter({ visible: true })).toHaveCount(
        0,
      );
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.setViewportSize({ width: 768, height: 900 });
      await expect(page.getByTestId("portal-bottom-nav")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByTestId("student-mobile-more").press("Enter");
    const themeToggle = page.getByTestId("theme-toggle").filter({ visible: true });
    await themeToggle.click({ force: true });
    await expect(page.locator("html")).toHaveClass(/dark/);

    for (const item of pages[locale]) {
      await page.goto(`/${locale}/student/${item.section}`);
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(page.getByTestId("student-page-shell")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
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
