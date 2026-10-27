import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

test("public teacher application is reviewed, accepted, invited, and activated once", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const suffix = randomUUID().slice(0, 8);
  const fullName = `Teacher Applicant ${suffix}`;
  const email = `teacher.application.${suffix}@noor.local`;
  const password = `Teacher-Invite-${randomUUID()}!`;
  const db = serviceClient();

  try {
    await page.goto("/en/join-teachers");
    await expect(page.getByRole("heading", { name: /Teach with clarity/ })).toBeVisible();
    await fillApplication(page, { email, fullName, includeCv: true });
    await page.getByRole("button", { name: "Send teaching application" }).click();
    await expect(page.getByText("Your teaching application was received")).toBeVisible();
    const applicationNumber = await page.getByTestId("teacher-application-number").textContent();
    expect(applicationNumber).toMatch(/^NW-T-[A-F0-9]{20}$/);

    await page.goto("/en/join-teachers");
    await fillApplication(page, { email, fullName, includeCv: false });
    await page.getByRole("button", { name: "Send teaching application" }).click();
    await expect(page.getByText(/An open application already exists/)).toBeVisible();

    await signInAs(page, "en", "admin");
    await page.goto(`/en/admin/teacher-applications?q=${encodeURIComponent(email)}`);
    const card = page.locator("details").filter({ hasText: email });
    await card.getByText(fullName, { exact: true }).click();
    const cvResponse = await page.request.get(
      await card.getByRole("link", { name: "Download CV" }).getAttribute("href").then(required),
    );
    expect(cvResponse.status()).toBe(200);
    expect(cvResponse.headers()["content-type"]).toContain("application/pdf");
    expect((await cvResponse.body()).subarray(0, 4).toString()).toBe("%PDF");

    await card.getByLabel("Review status").selectOption("reviewing");
    await card.getByLabel("Internal review notes").fill("Qualifications checked in local E2E.");
    await card.getByRole("button", { name: "Save review" }).click();
    await expect(page).toHaveURL(/teacherApplicationStatus=updated/);

    const reviewingCard = page.locator("details").filter({ hasText: email });
    await reviewingCard.getByText(fullName, { exact: true }).click();
    await reviewingCard.getByLabel("Review status").selectOption("accepted");
    await reviewingCard.getByRole("button", { name: "Save review" }).click();
    await expect(page).toHaveURL(/teacherApplicationStatus=updated/);

    const messageIds = await getMessageIds(page);
    const acceptedCard = page.locator("details").filter({ hasText: email });
    await expect(
      acceptedCard.locator("summary").getByText("Accepted", { exact: true }),
    ).toBeVisible();
    await acceptedCard.locator("summary").click();
    await expect(acceptedCard).toHaveAttribute("open", "");
    const inviteButton = acceptedCard.getByRole("button", {
      name: "Create teacher & send invite",
    });
    await expect(inviteButton).toBeVisible();
    await inviteButton.click();
    await expect(page).toHaveURL(/teacherApplicationStatus=invited/);
    await expect(page.getByText("The teacher account was created")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create teacher & send invite" })).toHaveCount(0);

    const invitationId = await waitForMessage(page, messageIds, email);
    const messageResponse = await page.request.get(`${mailpitUrl}/api/v1/message/${invitationId}`);
    const message = (await messageResponse.json()) as { Text: string };
    const invitationLink = message.Text.match(/https?:\/\/\S+(?=\s\))/)?.[0];
    expect(invitationLink).toBeDefined();

    await page.goto(invitationLink ?? "about:blank");
    await expect(page).toHaveURL(/\/en\/auth\/reset-password$/);
    const resetForm = page.locator("form").filter({ has: page.locator("#passwordConfirm") });
    await resetForm.locator("#password").fill(password);
    await resetForm.locator("#passwordConfirm").fill(password);
    await resetForm.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/en\/auth\/login\?status=password_updated$/);

    const loginForm = page.locator("form").filter({ has: page.locator("#email") });
    await loginForm.locator("#email").fill(email);
    await loginForm.locator("#password").fill(password);
    await loginForm.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/en\/teacher\/today$/);
    await expect(page.getByRole("heading", { name: "My sessions today" })).toBeVisible();
  } finally {
    await cleanup(db, email);
  }
});

for (const locale of [
  { code: "ar", title: "علّم بوضوح وعناية وخطة تعليمية ثابتة" },
  { code: "en", title: "Teach with clarity, care, and a steady educational plan" },
] as const) {
  for (const viewport of [
    { name: "mobile", width: 360, height: 800 },
    { name: "tablet", width: 768, height: 900 },
    { name: "desktop", width: 1440, height: 900 },
  ] as const) {
    test(`${locale.code} teacher application is accessible at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: viewport.name === "tablet" ? "dark" : "light" });
      await page.goto(`/${locale.code}/join-teachers`);
      await expect(page.getByRole("heading", { name: locale.title })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
}

async function fillApplication(
  page: Page,
  options: { email: string; fullName: string; includeCv: boolean },
) {
  await page.getByLabel("Full name").fill(options.fullName);
  await page.getByLabel("Email address").fill(options.email);
  await page.getByLabel("Phone number").fill("+201001234567");
  await page.getByLabel("Teaching specialisation").fill("Tajweed and recitation");
  await page.getByLabel("Years of experience").fill("5");
  await page
    .getByLabel("Qualifications and ijazah details")
    .fill("Certified Quran and Tajweed teacher with an approved ijazah.");
  await page.getByRole("checkbox", { name: "English", exact: true }).check();
  await page.getByLabel("Regular availability").fill("Sunday and Tuesday from 18:00 to 21:00.");
  if (options.includeCv) {
    await page.getByLabel("CV (optional)").setInputFiles({
      name: "teacher-cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nTeacher CV\n%%EOF"),
    });
  }
  await page.getByRole("checkbox", { name: /I agree to the processing/ }).check();
}

async function getMessageIds(page: Page) {
  const response = await page.request.get(`${mailpitUrl}/api/v1/messages`);
  const body = (await response.json()) as { messages: Array<{ ID: string }> };
  return new Set(body.messages.map(({ ID }) => ID));
}

async function waitForMessage(page: Page, existing: Set<string>, email: string) {
  let messageId = "";
  await expect
    .poll(async () => {
      const response = await page.request.get(`${mailpitUrl}/api/v1/messages`);
      const body = (await response.json()) as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      messageId =
        body.messages.find(
          (message) =>
            !existing.has(message.ID) && message.To.some(({ Address }) => Address === email),
        )?.ID ?? "";
      return messageId;
    })
    .toBeTruthy();
  return messageId;
}

function required(value: string | null) {
  if (!value) throw new Error("Expected a download link.");
  return value;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing local Supabase test environment.");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function cleanup(db: ReturnType<typeof serviceClient>, email: string) {
  const { data: application } = await db
    .from("teacher_applications")
    .select("id,cv_path,invited_user_id")
    .eq("email", email)
    .maybeSingle();
  if (!application) return;
  if (application.cv_path) {
    await db.storage.from("teacher-applications").remove([application.cv_path]);
  }
  await db.from("teacher_applications").delete().eq("id", application.id);
  if (application.invited_user_id) {
    await db.from("teachers").delete().eq("profile_id", application.invited_user_id);
    await db.from("profiles").delete().eq("id", application.invited_user_id);
    await db.auth.admin.deleteUser(application.invited_user_id);
  }
}
