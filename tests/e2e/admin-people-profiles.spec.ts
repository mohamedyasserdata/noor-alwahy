import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("admin student and teacher profiles preserve context without mutating data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInAs(page, "ar", "admin");

  await page.goto("/ar/admin/students");
  const studentProfileHref = await page
    .getByRole("link", { name: "الملف الشامل" })
    .first()
    .getAttribute("href");
  expect(studentProfileHref).toMatch(/^\/ar\/admin\/students\/[0-9a-f-]+$/);
  const demoStudentId = studentProfileHref!.split("/").at(-1)!;
  await page.goto(studentProfileHref!);
  await expect(page.getByTestId("admin-student-profile")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "إدارة التعيين" })).toHaveAttribute(
    "href",
    /\/ar\/admin\/assignments\?studentId=/,
  );
  await expectNoHorizontalOverflow(page);

  await page.goto("/ar/admin/teachers");
  const teacherProfileHref = await page
    .getByRole("link", { name: "فتح ملف المعلم" })
    .first()
    .getAttribute("href");
  expect(teacherProfileHref).toMatch(/^\/ar\/admin\/teachers\/[0-9a-f-]+$/);
  const demoTeacherId = teacherProfileHref!.split("/").at(-1)!;
  await page.goto(teacherProfileHref!);
  await expect(page.getByTestId("admin-teacher-profile")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "جدول المعلم" })).toHaveAttribute(
    "href",
    `/ar/admin/schedule?teacherId=${demoTeacherId}`,
  );
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/ar/admin/students/${demoStudentId}`);
  await expect(page.getByTestId("admin-student-profile")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(`/ar/admin/schedule?studentId=${demoStudentId}`);
  await expect(page.getByText("تعرض الصفحة الآن الجدول المرتبط بالملف المحدد.")).toBeVisible();

  await page.goto(`/ar/admin/attendance?teacherId=${demoTeacherId}`);
  await expect(page.getByText("يعرض التقرير الآن السجل المرتبط بالملف المحدد.")).toBeVisible();
});

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}
