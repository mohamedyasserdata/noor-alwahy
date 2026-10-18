import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

const defaults = {
  nameAr: "أكاديمية نور الوحي",
  nameEn: "Noor Al-Wahy Academy",
  descriptionAr: "تعليم قرآني منظم بمتابعة آمنة وواضحة.",
  descriptionEn: "Structured Quran learning with safe, clear follow-up.",
  supportAr: "تكون الاستجابة خلال مواعيد العمل المعلنة للأكاديمية.",
  supportEn: "Responses are provided during the academy’s announced working hours.",
};

async function fillSettings(
  page: Parameters<typeof signInAs>[0],
  values: typeof defaults & { logoPath: string },
) {
  await page.locator("#academy-nameAr").fill(values.nameAr);
  await page.locator("#academy-nameEn").fill(values.nameEn);
  await page.locator("#academy-descriptionAr").fill(values.descriptionAr);
  await page.locator("#academy-descriptionEn").fill(values.descriptionEn);
  await page.locator("#app-logo-path").fill(values.logoPath);
  await page.locator("#support-hours-ar").fill(values.supportAr);
  await page.locator("#support-hours-en").fill(values.supportEn);
}

test("US-154 admin updates audited public academy settings atomically", async ({ page }) => {
  test.setTimeout(90_000);
  const changed = {
    nameAr: "أكاديمية نور الاختبار",
    nameEn: "Noor Test Academy",
    descriptionAr: "هوية عامة آمنة لاختبار إعدادات الأكاديمية.",
    descriptionEn: "A safe public identity used to verify academy settings.",
    logoPath: "/icon.svg",
    supportAr: "الأحد إلى الخميس، من التاسعة صباحًا إلى الخامسة مساءً.",
    supportEn: "Sunday through Thursday, 9:00–17:00 Cairo time.",
  };

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Academy settings" })).toBeVisible();
  await fillSettings(page, changed);
  await page.getByRole("button", { name: "Save public settings" }).click();

  await expect(page).toHaveURL(/\/en\/admin\/settings\?settingStatus=updated$/);
  await expect(page.getByText("The public academy settings were updated.")).toBeVisible();
  await expect(page.getByText(changed.nameEn, { exact: true }).first()).toBeVisible();
  await expect(page.locator('img[src*="icon.svg"]').first()).toBeVisible();

  await signInAs(page, "en", "student");
  await page.goto("/en/student/contact");
  await expect(page.getByText(changed.nameEn, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(changed.supportEn, { exact: true })).toBeVisible();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/audit?table=app_settings&record=academy_profile");
  await expect(page.getByRole("status")).toHaveText("Matching records: 1");
  await expect(page.locator("table").getByText("Updated", { exact: true })).toBeVisible();

  await page.goto("/en/admin/settings");
  await fillSettings(page, { ...defaults, logoPath: "" });
  await page.getByRole("button", { name: "Save public settings" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/settings\?settingStatus=updated$/);
});
