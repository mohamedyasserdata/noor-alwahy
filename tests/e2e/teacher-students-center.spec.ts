import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("teacher student center filters assigned students and opens the complete student profile", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = captureConsoleProblems(page);
  await signInAs(page, "ar", "teacher");

  for (const width of [360, 768, 1440] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ar/teacher/students");
    await expect(page.getByTestId("teacher-students-center")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/ar/teacher/students");
  const studentCard = page.getByTestId("teacher-student-card").first();
  await expect(studentCard).toBeVisible();
  const studentName = (await studentCard.locator("p").first().innerText()).trim();
  await page.getByRole("searchbox", { name: "ابحث بالاسم أو رقم الطالب" }).fill(studentName);
  await page.getByRole("button", { name: "تطبيق" }).click();
  await expect(page).toHaveURL(/q=/);
  const matchingCard = page
    .getByTestId("teacher-student-card")
    .filter({ hasText: studentName })
    .first();
  await expect(matchingCard).toBeVisible();

  await matchingCard.getByRole("link", { name: "فتح الملف" }).click();
  await expect(page.getByTestId("teacher-student-profile")).toBeVisible();
  await expect(page.getByRole("heading", { name: studentName, exact: true })).toBeVisible();

  for (const tab of [
    "نظرة عامة",
    "الحصص والحضور",
    "خطة الحفظ",
    "التقييمات والتسميع",
    "التقارير",
    "الملاحظات",
  ]) {
    await page.getByTestId("student-profile-tabs").getByRole("link", { name: tab }).click();
    await expect(page.getByTestId("teacher-student-profile")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await page.goto("/ar/teacher/students/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText(/404|غير موجود/i).first()).toBeVisible();
  expect(problems).toEqual([]);
});

test("teacher student center supports English and LTR", async ({ page }) => {
  await signInAs(page, "en", "teacher");
  await page.goto("/en/teacher/students");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "My students" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

function captureConsoleProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}
