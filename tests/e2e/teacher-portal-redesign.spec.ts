import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { signInAs } from "./helpers/auth";

const sections = [
  "today",
  "schedule",
  "students",
  "attendance",
  "evaluations",
  "reports",
  "notifications",
  "requests",
  "earnings",
  "profile",
] as const;

test("teacher portal keeps every section usable and captures the completed interface", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const problems = captureConsoleProblems(page);
  const output = join(process.cwd(), "output", "screenshots", "teacher");
  await mkdir(output, { recursive: true });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await signInAs(page, "ar", "teacher");

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const section of sections) {
    await page.goto(`/ar/teacher/${section}`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByTestId("portal-sidebar")).toBeVisible();
    await expect(page.locator("text=Runtime Error")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: join(output, `ar-${section}-1440.png`),
      fullPage: true,
    });
  }

  await page.goto("/ar/teacher/profile");
  const displayName = await page.locator("#teacher-display-name").inputValue();
  await page.locator("#teacher-display-name").fill(displayName);
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await expect(page).toHaveURL(/profileStatus=saved/);
  await expect(page.getByText("حُفظت إعدادات الملف الشخصي.", { exact: true })).toBeVisible();

  for (const width of [360, 768] as const) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of sections) {
      await page.goto(`/ar/teacher/${section}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    await page.goto("/ar/teacher/today");
    await page.screenshot({
      path: join(output, `ar-today-${width}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en/teacher/today");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("main h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => {
    localStorage.setItem("noor-theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("main h1").first()).toBeVisible();
  expect(problems).toEqual([]);
});

function captureConsoleProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes('style={{caret-color:"transparent"}}')
    ) {
      problems.push(message.text());
    }
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}
