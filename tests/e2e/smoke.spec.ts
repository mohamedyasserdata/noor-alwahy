import { expect, test } from "@playwright/test";

for (const locale of [
  { code: "ar", connected: "متصل", direction: "rtl" },
  { code: "en", connected: "Connected", direction: "ltr" },
] as const) {
  test(`${locale.code} renders the live Supabase Server Component result`, async ({ page }) => {
    const consoleProblems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        consoleProblems.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${locale.code}/dev/supabase`);

    await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
    await expect(page.getByTestId("supabase-status")).toHaveText(locale.connected);
    await expect(page.getByTestId("supabase-query-result")).toBeVisible();
    await expect(page.getByTestId("supabase-api-version")).toHaveText(/\S+/);

    const viewport = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(viewport.scrollWidth).toBe(viewport.innerWidth);
    expect(consoleProblems).toEqual([]);
  });
}
