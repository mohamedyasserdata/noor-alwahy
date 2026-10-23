import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { signInAs } from "./helpers/auth";

test("US-153 admin manages audited official links visible to students and parents", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const suffix = `${testInfo.retry + 1}-${randomUUID().slice(0, 8)}`;
  const labelAr = `دعم الأكاديمية ${suffix}`;
  const labelEn = `Academy support ${suffix}`;
  const destination = `https://example.com/noor-support-${suffix}`;

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/settings");
  await expect(page.getByRole("heading", { level: 2, name: "Contact channels" })).toBeVisible();

  const createForm = page.locator("form").filter({ has: page.locator("#contact-url-new") });
  await createForm.locator("#contact-type-new").selectOption("telegram");
  await createForm.locator("#contact-order-new").fill("7");
  await createForm.locator("#contact-ar-new").fill(labelAr);
  await createForm.locator("#contact-en-new").fill(labelEn);
  await createForm.locator("#contact-url-new").fill(destination);
  await createForm.getByRole("button", { name: "Add channel" }).click();

  await expect(page).toHaveURL(/\/en\/admin\/settings\?status=created$/);
  await expect(page.locator('[data-slot="alert"]')).toContainText("was added");
  const card = page.locator('[data-testid^="contact-link-"]', {
    has: page.locator(`input[name="labelEn"][value="${labelEn}"]`),
  });
  await expect(card).toContainText("Visible");
  const id = await card.locator('input[name="id"]').first().inputValue();

  await signInAs(page, "en", "student");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/student/contact");
  const studentLink = page.getByRole("link", { name: new RegExp(labelEn) });
  await expect(studentLink).toHaveAttribute("href", destination);
  await expect(studentLink).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("portal-navigation-bottom").getByRole("link")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  await signInAs(page, "ar", "parent");
  await page.goto("/ar/parent/contact");
  await expect(page.getByRole("link", { name: new RegExp(labelAr) })).toBeVisible();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/settings");
  const editCard = page.locator('[data-testid^="contact-link-"]', {
    has: page.locator(`input[name="labelEn"][value="${labelEn}"]`),
  });
  const editForm = editCard.locator("form").first();
  await editForm.locator('input[name="isVisible"]').uncheck();
  await editForm.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/settings\?status=updated$/);

  await signInAs(page, "en", "student");
  await page.goto("/en/student/contact");
  await expect(page.getByRole("link", { name: new RegExp(labelEn) })).toHaveCount(0);

  await signInAs(page, "en", "admin");
  await page.goto(`/en/admin/audit?table=contact_links&record=${id}`);
  await expect(page.getByRole("status")).toHaveText("Matching records: 2");
  const mobileAuditTimeline = page.locator("ol");
  await expect(mobileAuditTimeline.getByText("Created", { exact: true })).toBeVisible();
  await expect(mobileAuditTimeline.getByText("Updated", { exact: true })).toBeVisible();

  await page.goto("/en/admin/settings");
  await page
    .locator('[data-testid^="contact-link-"]', {
      has: page.locator(`input[name="labelEn"][value="${labelEn}"]`),
    })
    .getByRole("button", { name: "Delete channel" })
    .click();
  await expect(page).toHaveURL(/\/en\/admin\/settings\?status=deleted$/);
  await expect(page.getByText(labelEn, { exact: true })).toHaveCount(0);

  await page.goto(`/en/admin/audit?table=contact_links&record=${id}`);
  await expect(page.locator("ol").getByText("Deleted", { exact: true })).toBeVisible();
});
