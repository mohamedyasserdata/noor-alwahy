import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("admin capacity forecast and saved filters work without leaving test data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInAs(page, "ar", "admin");

  await expect(page.getByTestId("teacher-capacity-forecast")).toBeVisible();
  await expect(page.getByText("تقدير تشغيلي", { exact: false })).toBeVisible();

  await page.goto("/ar/admin/students?workflow=awaiting_assignment");
  const savedViews = page.getByTestId("admin-saved-views-students");
  await expect(savedViews).toBeVisible();
  const viewName = `اختبار انتظار ${Date.now()}`;
  await savedViews.getByLabel("اسم العرض").fill(viewName);
  await savedViews.getByRole("button", { name: "حفظ العرض" }).click();
  const savedLink = savedViews.getByRole("link", { name: viewName });
  await expect(savedLink).toBeVisible();
  await expect(savedLink).toHaveAttribute("href", /workflow=awaiting_assignment/);

  await savedViews.getByRole("button", { name: `حذف ${viewName}` }).click();
  await expect(savedViews.getByRole("link", { name: viewName })).toHaveCount(0);

  await page.goto("/ar/admin/control-center");
  await expect(page.getByTestId("admin-saved-views-control-center")).toBeVisible();
});
