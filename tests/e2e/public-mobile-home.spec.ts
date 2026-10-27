import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const screenshotDir = join(process.cwd(), "output", "screenshots");

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("first visit defaults to Arabic and light mode", async ({ browser }) => {
  const context = await browser.newContext({
    colorScheme: "dark",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  const page = await context.newPage();

  await page.goto("/");

  await expect(page).toHaveURL(/\/ar\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe("light");

  await context.close();
});

for (const width of [320, 360, 390, 430]) {
  test(`mobile navbar stays compact and balanced at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/ar");

    const navbar = page.getByTestId("public-navbar");
    const brand = navbar.getByRole("link", { name: "أكاديمية نور الوحي" });
    const menu = navbar.getByRole("button", { name: "فتح قائمة الموقع" });
    const box = await navbar.boundingBox();

    await expect(navbar).toBeVisible();
    await expect(brand).toBeVisible();
    await expect(menu).toBeVisible();
    expect(box?.height).toBeGreaterThanOrEqual(68);
    expect(box?.height).toBeLessThanOrEqual(72);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(screenshotDir, `mobile-navbar-ar-${width}.png`),
      fullPage: false,
    });
  });
}

for (const width of [320, 360, 390, 430]) {
  test(`mobile sections keep a compact transition at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/ar");

    const features = page.getByTestId("public-hero-features");
    const tracks = page.getByTestId("public-tracks-section");
    const featuresBox = await features.boundingBox();
    const tracksEyebrowBox = await tracks.locator("header p").first().boundingBox();

    expect(featuresBox).not.toBeNull();
    expect(tracksEyebrowBox).not.toBeNull();
    const sectionGap =
      (tracksEyebrowBox?.y ?? 0) - ((featuresBox?.y ?? 0) + (featuresBox?.height ?? 0));
    expect(sectionGap).toBeGreaterThanOrEqual(39);
    expect(sectionGap).toBeLessThanOrEqual(40);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: join(screenshotDir, `mobile-section-transition-ar-${width}.png`),
      fullPage: true,
    });
  });
}

test("mobile navbar mirrors cleanly in English", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/en");

  const navbar = page.getByTestId("public-navbar");
  await expect(navbar.getByRole("link", { name: "Noor Al-Wahy Academy" })).toBeVisible();
  await expect(navbar.getByRole("button", { name: "Open site menu" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: join(screenshotDir, "mobile-navbar-en-320.png"),
    fullPage: false,
  });
});

test("mobile homepage uses the compact transparent hero and closes navigation after selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/ar");

  const hero = page.getByTestId("public-home-hero-copy");
  await expect(hero).toBeVisible();
  await expectTransparent(hero);
  expect(await hero.evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
  expect(await hero.evaluate((element) => getComputedStyle(element).textAlign)).toMatch(
    /^(start|right)$/,
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: join(screenshotDir, "mobile-home-ar-360.png"),
    fullPage: false,
  });

  await page.getByRole("button", { name: "فتح قائمة الموقع" }).click();
  const dialog = page.getByRole("dialog", { name: "التنقل في الموقع العام" });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: join(screenshotDir, "mobile-menu-ar-360.png"),
    fullPage: false,
  });
  await dialog.getByRole("link", { name: "المسارات" }).click();
  await expect(page).toHaveURL(/\/ar\/?#tracks$/);
  await expect(dialog).toBeHidden();
});

test("tablet hero stays transparent and follows locale alignment without changing desktop navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/ar");
  const arabicHero = page.getByTestId("public-home-hero-copy");
  const tabletTracks = page.getByTestId("public-tracks-section");
  await expectTransparent(arabicHero);
  expect(
    await tabletTracks.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).paddingTop),
    ),
  ).toBe(80);
  expect(await arabicHero.evaluate((element) => getComputedStyle(element).textAlign)).toMatch(
    /^(start|right)$/,
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: join(screenshotDir, "tablet-home-ar-768.png"),
    fullPage: false,
  });

  await page.goto("/en");
  const englishHero = page.getByTestId("public-home-hero-copy");
  await expectTransparent(englishHero);
  expect(await englishHero.evaluate((element) => getComputedStyle(element).direction)).toBe("ltr");
  expect(await englishHero.evaluate((element) => getComputedStyle(element).textAlign)).toMatch(
    /^(start|left)$/,
  );
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ar");
  expect(
    await page
      .getByTestId("public-tracks-section")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop)),
  ).toBe(96);
  await expect(page.getByRole("navigation", { name: "التنقل في الموقع العام" })).toBeVisible();
  await expect(page.getByRole("button", { name: "فتح قائمة الموقع" })).toBeHidden();
});

async function expectTransparent(locator: ReturnType<Page["getByTestId"]>) {
  expect(await locator.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgba(0, 0, 0, 0)",
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
