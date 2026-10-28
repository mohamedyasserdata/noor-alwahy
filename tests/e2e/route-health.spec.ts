import { expect, test, type Page } from "@playwright/test";

import { portalConfig, type PortalId } from "@/components/portal/portal-config";

import { signInAs, type TestAccount } from "./helpers/auth";

const publicRoutes = [
  "/en",
  "/en/tracks",
  "/en/faq",
  "/en/contact",
  "/en/join-teachers",
  "/en/privacy",
  "/en/terms",
  "/en/apply",
  "/en/order-status",
] as const;

const extraAdminRoutes = ["/en/admin/packages/wizard", "/en/admin/packages/pricing-grid"];

async function expectHealthyRoute(page: Page, route: string) {
  const runtimeErrors: string[] = [];
  const onPageError = (error: Error) => runtimeErrors.push(error.message);
  page.on("pageerror", onPageError);

  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response, `${route} returned no navigation response`).not.toBeNull();
  expect(response!.status(), `${route} returned HTTP ${response!.status()}`).toBeLessThan(400);
  await expect(
    page.locator("main#main-content"),
    `${route} did not render its main content`,
  ).toBeVisible();
  expect(runtimeErrors, `${route} raised a browser runtime error`).toEqual([]);

  page.off("pageerror", onPageError);
}

test("all public product routes render without runtime errors", async ({ page }) => {
  for (const route of publicRoutes) await expectHealthyRoute(page, route);
});

const portalAccounts: Record<PortalId, TestAccount> = {
  admin: "admin",
  teacher: "teacher",
  student: "student",
  parent: "parent",
};

for (const portal of ["admin", "teacher", "student", "parent"] as const) {
  test(`all ${portal} portal routes render without runtime errors`, async ({ page }) => {
    await signInAs(page, "en", portalAccounts[portal]);

    for (const section of portalConfig[portal].sections) {
      await expectHealthyRoute(page, `/en/${portal}/${section}`);
    }

    if (portal === "admin") {
      for (const route of extraAdminRoutes) await expectHealthyRoute(page, route);
    }
  });
}
