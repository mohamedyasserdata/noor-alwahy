import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import type { Database } from "../../types/database.types";

test("P4-T08 teacher creates an individual plan and the student sees adherence", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signIn(page, fixture.teacherEmail, fixture.password, "teacher");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/teacher/students");
  await expect(
    page.getByRole("heading", { level: 1, name: "Student memorization plans" }),
  ).toBeVisible();
  const card = page.locator("article").filter({ hasText: fixture.studentName });
  await card.getByLabel("Weekly target (pages)").fill("6");
  await card.getByLabel("Monthly target (pages)").fill("24");
  await card.getByRole("button", { name: "Create plan" }).click();
  await expect(page).toHaveURL(/planStatus=created$/);
  await expect(page.getByText("The memorization plan was created.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await signIn(page, fixture.studentEmail, fixture.password, "student");
  await page.goto("/en/student/progress");
  const plan = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: "Your memorization plan" }),
  });
  await expect(plan.getByText("0 of 6 pages completed")).toBeVisible();
  await expect(plan.getByText("0 of 24 pages completed")).toBeVisible();
  await expect(plan.getByRole("progressbar", { name: "Weekly goal: 0%" })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ar/student/progress");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 2, name: "خطة حفظك" })).toBeVisible();
  await expect(page.getByText(/أُنجزت [٠0] من [٦6] صفحة/)).toBeVisible();
});

async function createFixture() {
  const db = databaseClient(required("SUPABASE_SERVICE_ROLE_KEY"));
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = "AcademyTest1!";
  const studentProfileId = crypto.randomUUID();
  const teacherProfileId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const teacherId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const studentName = `Plan Student ${suffix}`;
  const studentEmail = `plan-student-${suffix}@noor.local`;
  const teacherEmail = `plan-teacher-${suffix}@noor.local`;
  const timestamp = new Date().toISOString();

  for (const user of [
    { id: studentProfileId, email: studentEmail, role: "student", fullName: studentName },
    {
      id: teacherProfileId,
      email: teacherEmail,
      role: "teacher",
      fullName: `Plan Teacher ${suffix}`,
    },
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
  for (const write of [
    db.from("students").insert({
      id: studentId,
      profile_id: studentProfileId,
      full_name: studentName,
      gender: "male",
      timezone: "Africa/Cairo",
    }),
    db.from("teachers").insert({
      id: teacherId,
      profile_id: teacherProfileId,
      gender: "male",
      status: "active",
      identity_verified_at: timestamp,
      code_of_conduct_accepted_at: timestamp,
    }),
    db.from("tracks").insert({
      id: trackId,
      code: `plan-${suffix}`,
      name_ar: "اختبار خطة الحفظ",
      name_en: "Memorization plan browser test",
    }),
  ]) {
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

  return { password, studentEmail, studentName, teacherEmail };
}

async function signIn(page: Page, email: string, password: string, role: "teacher" | "student") {
  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/en/${role}/${role === "teacher" ? "today" : "home"}`));
}

function databaseClient(key: string) {
  return createClient<Database>(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
