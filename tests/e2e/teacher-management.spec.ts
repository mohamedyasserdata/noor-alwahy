import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("US-060 and US-061 teacher verification, conduct and availability workflow", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createTeacherCandidate();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/teachers");
  await expect(page.getByRole("heading", { level: 1, name: "Teacher management" })).toBeVisible();
  await page.locator("#profile-new").selectOption(fixture.profileId);
  await page.locator("#specialization-new").fill("Quran recitation");
  await page.locator("#riwaya-new").fill("Hafs");
  await page.locator("#sanad-new").fill("Identity checked against academy records");
  await page.locator("#capacity-new").fill("12");
  const createForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Create teacher profile" }) });
  await createForm.locator('input[name="identityVerified"]').check();
  await page.getByRole("button", { name: "Create teacher profile" }).click();
  await expect(page).toHaveURL(/teacherStatus=created$/);
  await expect(page.getByText("Teacher profile created.")).toBeVisible();

  await signIn(page, fixture.email, fixture.password);
  await page.goto("/en/teacher/availability");
  await page.getByRole("button", { name: "Accept conduct code" }).click();
  await expect(page).toHaveURL(/availabilityStatus=conduct_accepted$/);
  await expect(page.getByText("Conduct acceptance recorded.")).toBeVisible();
  await page.locator("#availability-weekday").selectOption("2");
  await page.locator("#availability-start").fill("09:00");
  await page.locator("#availability-end").fill("10:30");
  await page.getByRole("button", { name: "Send proposal" }).click();
  await expect(page).toHaveURL(/availabilityStatus=proposed$/);
  await expect(page.getByText("Tuesday · 09:00–10:30")).toBeVisible();
  await expect(page.getByText("Awaiting review")).toBeVisible();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/teachers");
  const availability = page.locator("div.rounded-2xl").filter({ hasText: "Tuesday · 09:00–10:30" });
  await availability.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/teacherStatus=approved$/);
  const teacherCard = page.locator("article").filter({ hasText: fixture.fullName }).first();
  await teacherCard.locator('select[name="status"]').selectOption("active");
  await teacherCard.getByRole("button", { name: "Save teacher profile" }).click();
  await expect(page).toHaveURL(/teacherStatus=updated$/);
  await expect(page.getByText("Teacher profile updated.")).toBeVisible();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
});

async function createTeacherCandidate() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `teacher-management-${suffix}@noor.local`;
  const password = "AcademyTest1!";
  const fullName = `Managed Teacher ${suffix}`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "teacher" },
    user_metadata: { full_name: fullName, role: "teacher" },
  });
  if (error) throw error;
  return { email, fullName, password, profileId: data.user.id };
}

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/teacher\/today(?:\?.*)?$/);
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
