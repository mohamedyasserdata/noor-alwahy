import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { signInAs } from "./helpers/auth";

const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

test("US-012/013 admin creates, audits, disables, reactivates, and invites accounts", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const suffix = `${testInfo.retry + 1}-${randomUUID().slice(0, 8)}`;
  const directEmail = `managed.student.${suffix}@noor.local`;
  const inviteEmail = `invited.teacher.${suffix}@noor.local`;
  const adminInviteEmail = `invited.admin.${suffix}@noor.local`;
  const password = `ManagedTest-${suffix}!`;

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/users");
  await expect(page.getByRole("heading", { level: 1, name: "User accounts" })).toBeVisible();

  const createForm = page.locator("form").filter({ has: page.locator("#accountEmail") });
  await createForm.locator("#fullName").fill("Managed Student");
  await createForm.locator("#accountEmail").fill(directEmail);
  await createForm.locator("#role").selectOption("student");
  await createForm.locator("#mode").selectOption("password");
  await createForm.locator("#temporaryPassword").fill(password);
  await createForm.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/en\/admin\/users\?status=created$/);
  await expect(page.locator('[data-slot="alert"]')).toContainText("The account was created");
  const directCard = page.locator("div.rounded-2xl").filter({ hasText: directEmail });
  await expect(directCard).toContainText("Managed Student");
  const profileId = await directCard.locator('input[name="profileId"]').inputValue();

  await page.goto(`/en/admin/audit?record=${profileId}`);
  const auditRow = page.getByRole("row", { name: new RegExp(profileId) });
  await expect(auditRow).toBeVisible();
  await expect(auditRow).toContainText("Created");

  await signInWithCredentials(page, directEmail, password);
  await expect(page).toHaveURL(/\/en\/student\/home$/);

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/users");
  await page
    .locator("div.rounded-2xl")
    .filter({ hasText: directEmail })
    .getByRole("button", { name: "Disable" })
    .click();
  await expect(page).toHaveURL(/\/en\/admin\/users\?status=disabled$/);

  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(directEmail);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/auth\/login\?error=invalid_credentials$/);

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/users");
  await page
    .locator("div.rounded-2xl")
    .filter({ hasText: directEmail })
    .getByRole("button", { name: "Activate" })
    .click();
  await expect(page).toHaveURL(/\/en\/admin\/users\?status=activated$/);
  await signInWithCredentials(page, directEmail, password);
  await expect(page).toHaveURL(/\/en\/student\/home$/);

  const messagesBefore = await getMessageIds(page);
  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/users");
  const inviteForm = page.locator("form").filter({ has: page.locator("#accountEmail") });
  await inviteForm.locator("#fullName").fill("Invited Teacher");
  await inviteForm.locator("#accountEmail").fill(inviteEmail);
  await inviteForm.locator("#role").selectOption("teacher");
  await inviteForm.locator("#mode").selectOption("invite");
  await inviteForm.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/en\/admin\/users\?status=invited$/);
  await expect
    .poll(async () => {
      const response = await page.request.get(`${mailpitUrl}/api/v1/messages`);
      const body = (await response.json()) as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      return body.messages.some(
        (message) =>
          !messagesBefore.has(message.ID) &&
          message.To.some(({ Address }) => Address === inviteEmail),
      );
    })
    .toBe(true);
  await expect(page.getByText(inviteEmail, { exact: true })).toBeVisible();

  const adminMessagesBefore = await getMessageIds(page);
  const adminInviteForm = page.locator("form").filter({ has: page.locator("#accountEmail") });
  await adminInviteForm.locator("#fullName").fill("Invited Administrator");
  await adminInviteForm.locator("#accountEmail").fill(adminInviteEmail);
  await adminInviteForm.locator("#role").selectOption("admin");
  await adminInviteForm.locator("#mode").selectOption("invite");
  await adminInviteForm.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/users\?status=invited$/);
  await expect
    .poll(async () => {
      const response = await page.request.get(`${mailpitUrl}/api/v1/messages`);
      const body = (await response.json()) as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      return body.messages.some(
        (message) =>
          !adminMessagesBefore.has(message.ID) &&
          message.To.some(({ Address }) => Address === adminInviteEmail),
      );
    })
    .toBe(true);
  await expect(page.getByText(adminInviteEmail, { exact: true })).toBeVisible();
});

async function signInWithCredentials(
  page: Parameters<typeof signInAs>[0],
  email: string,
  password: string,
) {
  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
}

async function getMessageIds(page: Parameters<typeof signInAs>[0]) {
  const response = await page.request.get(`${mailpitUrl}/api/v1/messages`);
  const body = (await response.json()) as { messages: Array<{ ID: string }> };
  return new Set(body.messages.map(({ ID }) => ID));
}
