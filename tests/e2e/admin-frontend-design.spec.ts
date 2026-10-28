import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers/auth";

const adminSections = [
  "dashboard",
  "control-center",
  "applications",
  "teacher-applications",
  "students",
  "teachers",
  "assignments",
  "users",
  "schedule",
  "attendance",
  "evaluation",
  "exams",
  "reports",
  "certificates",
  "packages",
  "subscriptions",
  "finance",
  "announcements",
  "templates",
  "audit",
  "settings",
] as const;

test("admin desktop keeps every section and uses the unified shell", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await signInAs(page, "ar", "admin");

  const sidebar = page.getByTestId("portal-sidebar");
  const topbar = page.getByTestId("admin-portal-topbar");
  await expect(sidebar).toBeVisible();
  await expect(topbar).toBeVisible();
  await expect(sidebar.getByTestId("account-menu")).toHaveCount(0);
  await expect(topbar.getByTestId("account-menu").filter({ visible: true })).toBeVisible();
  await expect(page.locator("[data-realtime-status]")).toHaveCount(1);
  await expect(page.getByTestId("portal-navigation-sidebar").locator("a")).toHaveCount(
    adminSections.length,
  );

  for (const section of adminSections) {
    await page.goto(`/ar/admin/${section}`);
    await expect(page).toHaveURL(new RegExp(`/ar/admin/${section}(?:\\?.*)?$`));
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.goto("/ar/admin/dashboard");
  await expect(page.locator(".admin-dashboard-metrics .admin-metric-card")).toHaveCount(8);
  await page.screenshot({
    path: "output/screenshots/admin-dashboard-ar-1440.png",
    fullPage: true,
  });
});

for (const viewport of [
  { width: 360, height: 900, name: "360" },
  { width: 768, height: 1024, name: "768" },
] as const) {
  test(`admin dashboard is responsive at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await signInAs(page, "ar", "admin");
    await expect(page.getByTestId("portal-sidebar")).toBeHidden();
    await expect(page.getByTestId("portal-bottom-nav")).toBeVisible();
    await expect(page.getByTestId("admin-portal-topbar")).toBeVisible();
    await expect(page.locator("[data-realtime-status]")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `output/screenshots/admin-dashboard-ar-${viewport.name}.png`,
      fullPage: true,
    });
    if (viewport.width === 360) {
      await page.getByTestId("admin-mobile-more").click();
      await expect(page.getByRole("heading", { name: "كل أقسام الإدارة" })).toBeVisible();
      await page.screenshot({
        path: "output/screenshots/admin-mobile-menu-ar-360.png",
        fullPage: false,
      });
    }
  });
}

test("admin English dark mode preserves LTR and controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInAs(page, "en", "admin");
  await page.getByTestId("theme-toggle").filter({ visible: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.locator("details.admin-dashboard-filter > summary").click();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect(page.getByRole("link", { name: "PDF" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: "output/screenshots/admin-dashboard-en-dark-1440.png",
    fullPage: true,
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.innerWidth);
}
