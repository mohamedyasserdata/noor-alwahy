import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers/auth";

const portals = [
  {
    id: "admin",
    section: "dashboard",
    title: { ar: "نظرة شاملة على الأكاديمية", en: "A complete academy overview" },
  },
  {
    id: "teacher",
    section: "today",
    title: { ar: "حصصي اليوم", en: "My sessions today" },
  },
  {
    id: "student",
    section: "home",
    title: { ar: "حصتك القادمة", en: "Your next session" },
  },
  {
    id: "parent",
    section: "home",
    title: { ar: "بوابة ولي الأمر", en: "Parent Portal" },
  },
] as const;

for (const locale of [
  { code: "ar", direction: "rtl" },
  { code: "en", direction: "ltr" },
] as const) {
  test(`${locale.code} portal shells use the bottom navigation through 768px`, async ({ page }) => {
    const consoleProblems = captureConsoleProblems(page);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 800 });

    for (const portal of portals) {
      await signInAs(page, locale.code, portal.id);
      await page.goto(`/${locale.code}/${portal.id}`);
      await expect(page).toHaveURL(
        new RegExp(`/${locale.code}/${portal.id}/${portal.section}(?:\\?.*)?$`),
      );
      await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(portal.title[locale.code]);
      await expect(page.getByTestId("portal-sidebar")).toBeHidden();
      if (portal.id === "student" || portal.id === "parent") {
        await expect(page.getByTestId(`${portal.id}-portal-header`)).toBeVisible();
        await expect(page.getByTestId("portal-bottom-nav")).toHaveCount(0);
        await expect(
          page
            .getByTestId("portal-navigation-top")
            .filter({ visible: true })
            .locator('a[aria-current="page"]'),
        ).toHaveCount(1);
      } else {
        await expect(page.getByTestId("portal-bottom-nav")).toBeVisible();
        await expect(
          page.getByTestId("portal-navigation-bottom").locator('a[aria-current="page"]'),
        ).toHaveCount(1);
      }

      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
    }

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByTestId("portal-sidebar")).toBeHidden();
    await expect(page.getByTestId("portal-bottom-nav")).toHaveCount(0);
    await expect(page.getByTestId("parent-portal-header")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(consoleProblems).toEqual([]);
  });

  test(`${locale.code} portal shells use the sidebar above 768px`, async ({ page }) => {
    const consoleProblems = captureConsoleProblems(page);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const portal of portals) {
      await signInAs(page, locale.code, portal.id);
      await page.goto(`/${locale.code}/${portal.id}/${portal.section}`);
      if (portal.id === "student" || portal.id === "parent") {
        await expect(page.getByTestId("portal-sidebar")).toHaveCount(0);
        await expect(page.getByTestId(`${portal.id}-portal-header`)).toBeVisible();
        await expect(
          page
            .getByTestId("portal-navigation-top")
            .filter({ visible: true })
            .locator('a[aria-current="page"]'),
        ).toHaveCount(1);
      } else {
        await expect(page.getByTestId("portal-sidebar")).toBeVisible();
        await expect(page.getByTestId("portal-bottom-nav")).toBeHidden();
        await expect(
          page.getByTestId("portal-navigation-sidebar").locator('a[aria-current="page"]'),
        ).toHaveCount(1);
      }
      await expectNoHorizontalOverflow(page);
      await expectTouchTargets(page);
    }

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId("portal-sidebar")).toHaveCount(0);
    await expect(page.getByTestId("parent-portal-header")).toBeVisible();
    expect(consoleProblems).toEqual([]);
  });
}

test("dark theme is accessible and persists across reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await signInAs(page, "ar", "student");
  await page.goto("/ar/student/home");
  await page.evaluate(() => {
    localStorage.removeItem("noor-theme");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
  });
  await page.reload();

  const toggle = page.getByTestId("theme-toggle").filter({ visible: true });
  await expect(toggle).toHaveAttribute("aria-label", "تفعيل الوضع الداكن");
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(toggle).toHaveAttribute("aria-label", "تفعيل الوضع الفاتح");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#091a33");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("noor-theme"))).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByTestId("theme-toggle").filter({ visible: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("account settings panel stays inside the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signInAs(page, "ar", "student");
  await page.goto("/ar/student/home");

  const accountMenu = page.getByTestId("account-menu").filter({ visible: true });
  await accountMenu.locator("summary").click();
  await expect(page.getByRole("region", { name: "إعدادات الحساب" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("admin sidebar scrolls on laptop-height viewports", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1226, height: 668 });
  await signInAs(page, "ar", "admin");
  await page.goto("/ar/admin/templates");

  const navigation = page.getByTestId("portal-navigation-sidebar");
  await expect(navigation).toBeVisible();
  await expect
    .poll(() => navigation.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);

  const lastLink = navigation.locator("a").last();
  await lastLink.scrollIntoViewIfNeeded();
  await expect(lastLink).toBeInViewport();
  await expect.poll(() => navigation.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

function captureConsoleProblems(page: Page) {
  const problems: string[] = [];

  page.on("response", (response) => {
    if (response.status() === 401) problems.push(`response: 401 ${response.url()}`);
  });

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
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.dataset.testid ?? "",
          text: element.textContent?.trim().slice(0, 48) ?? "",
          horizontalStart: Math.round(rect.x),
          horizontalEnd: Math.round(rect.x + rect.width),
          width: Math.round(rect.width),
        };
      })
      .filter(
        ({ horizontalStart, horizontalEnd, width }) =>
          width > 0 && (horizontalStart < -1 || horizontalEnd > window.innerWidth + 1),
      )
      .slice(0, 8),
  }));

  expect(viewport, `Horizontal overflow: ${JSON.stringify(viewport.offenders)}`).toMatchObject({
    scrollWidth: viewport.innerWidth,
  });
}

async function expectTouchTargets(page: Page) {
  const undersizedTargets = await page
    .getByTestId(/portal-shell-/)
    .locator("a:visible, button:visible")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
            width: rect.width,
            height: rect.height,
          };
        })
        .filter(({ width, height }) => width < 44 || height < 44),
    );

  expect(undersizedTargets).toEqual([]);
}
