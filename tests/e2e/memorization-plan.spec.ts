import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import type { Database } from "../../types/database.types";

test("P4-T08 teacher saves an individual plan and the student sees adherence", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signIn(page, fixture.teacherEmail, fixture.password, "teacher/today");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/teacher/students");

  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: fixture.studentName }) });
  await expect(card).toBeVisible();
  await expect(card.getByText("Current goal", { exact: true })).toBeVisible();
  await expect(card.getByText("Required", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: "Evaluation" })).toHaveAttribute(
    "href",
    `/en/teacher/evaluations?student=${fixture.studentId}`,
  );
  await expect(card.getByRole("link", { name: "Attendance" })).toHaveAttribute(
    "href",
    `/en/teacher/attendance?student=${fixture.studentId}`,
  );
  await expect(card.getByRole("link", { name: "Report" })).toHaveAttribute(
    "href",
    `/en/teacher/reports?student=${fixture.studentId}`,
  );
  await card.getByLabel("Pages per week").fill("5");
  await card.getByLabel("Pages per month").fill("20");
  await card.getByRole("button", { name: "Create plan" }).click();
  await expect(page).toHaveURL(/\/en\/teacher\/students\?planStatus=saved$/);
  await expect(
    page.getByText("The memorization plan was saved and adherence was refreshed."),
  ).toBeVisible();
  await expect(card.getByText("Active plan", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const db = databaseClient();
  const { data: saved, error } = await db
    .from("memorization_plans")
    .select("weekly_target_pages,monthly_target_pages")
    .eq("student_id", fixture.studentId)
    .single();
  if (error) throw error;
  expect(saved).toEqual({ weekly_target_pages: 5, monthly_target_pages: 20 });

  await signIn(page, fixture.studentEmail, fixture.password, "student/home");
  await page.goto("/en/student/progress");
  const planCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Your memorization plan" }) });
  await expect(planCard).toBeVisible();
  await expect(planCard.getByText("0 of 5 pages", { exact: true })).toBeVisible();
  await expect(planCard.getByText("0 of 20 pages", { exact: true })).toBeVisible();
  await expect(
    planCard.getByRole("progressbar", { name: "0% of the target is complete" }),
  ).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

async function createFixture() {
  const db = databaseClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = "AcademyTest1!";
  const teacherProfileId = crypto.randomUUID();
  const studentProfileId = crypto.randomUUID();
  const teacherId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const teacherEmail = `plan-teacher-${suffix}@noor.local`;
  const studentEmail = `plan-student-${suffix}@noor.local`;
  const studentName = `Plan Student ${suffix}`;
  const timestamp = new Date().toISOString();

  for (const user of [
    {
      id: teacherProfileId,
      email: teacherEmail,
      role: "teacher",
      fullName: `Plan Teacher ${suffix}`,
    },
    { id: studentProfileId, email: studentEmail, role: "student", fullName: studentName },
  ]) {
    const { error } = await db.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password,
      email_confirm: true,
      app_metadata: { role: user.role },
      user_metadata: { full_name: user.fullName, role: user.role },
    });
    if (error) throw error;
  }

  const writes = [
    db.from("teachers").insert({
      id: teacherId,
      profile_id: teacherProfileId,
      gender: "male",
      status: "active",
      identity_verified_at: timestamp,
      code_of_conduct_accepted_at: timestamp,
    }),
    db.from("students").insert({
      id: studentId,
      profile_id: studentProfileId,
      full_name: studentName,
      gender: "male",
      timezone: "Africa/Cairo",
    }),
    db.from("tracks").insert({
      id: trackId,
      code: `plan-${suffix}`,
      name_ar: "اختبار خطة الحفظ",
      name_en: "Memorization plan browser test",
    }),
  ];
  for (const write of writes) {
    const { error } = await write;
    if (error) throw error;
  }
  const { error: teacherTrackError } = await db
    .from("teacher_tracks")
    .insert({ teacher_id: teacherId, track_id: trackId });
  if (teacherTrackError) throw teacherTrackError;
  const { error: assignmentError } = await db.from("teacher_assignments").insert({
    student_id: studentId,
    teacher_id: teacherId,
    track_id: trackId,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Memorization plan browser test",
  });
  if (assignmentError) throw assignmentError;

  return { password, studentEmail, studentId, studentName, teacherEmail };
}

async function signIn(page: Page, email: string, password: string, home: string) {
  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/en/${home}(?:\\?.*)?$`), { timeout: 20_000 });
}

function databaseClient() {
  return createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    },
  );
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
