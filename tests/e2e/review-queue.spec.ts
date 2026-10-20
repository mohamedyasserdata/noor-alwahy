import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { expect, test, type Page } from "@playwright/test";

import type { Database } from "../../types/database.types";

test("P4-T06 teacher sees the pre-session review queue state on mobile", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signIn(page, fixture.teacherEmail, fixture.teacherPassword);
  await page.setViewportSize({ width: 360, height: 800 });

  const sessionCard = page.locator("li").filter({ hasText: fixture.studentName });
  await expect(sessionCard).toBeVisible();
  await expect(
    sessionCard.getByRole("heading", { name: "Pre-session review queue" }),
  ).toBeVisible();
  await expect(
    sessionCard.getByText("No review pages are due for this student today."),
  ).toBeVisible();
  await expect(sessionCard.getByText("0 pages", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

async function createFixture() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const suffix = crypto.randomUUID().slice(0, 8);
  const teacherPassword = "AcademyTest1!";
  const teacherEmail = `review-queue-${suffix}@noor.local`;
  const teacherProfileId = crypto.randomUUID();
  const teacherId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const studentName = `Review Queue ${suffix}`;
  const localStart = DateTime.now().setZone("Africa/Cairo").startOf("day").plus({ hours: 18 });
  const scheduledAt = requiredTime(localStart.toUTC().toISO());
  const endsAt = requiredTime(localStart.plus({ minutes: 30 }).toUTC().toISO());
  const timestamp = requiredTime(DateTime.utc().toISO());

  const { error: userError } = await db.auth.admin.createUser({
    id: teacherProfileId,
    email: teacherEmail,
    password: teacherPassword,
    email_confirm: true,
    app_metadata: { role: "teacher" },
    user_metadata: { full_name: `Review Teacher ${suffix}`, role: "teacher" },
  });
  if (userError) throw userError;

  const { error: teacherError } = await db.from("teachers").insert({
    id: teacherId,
    profile_id: teacherProfileId,
    gender: "male",
    status: "active",
    identity_verified_at: timestamp,
    code_of_conduct_accepted_at: timestamp,
  });
  if (teacherError) throw teacherError;

  const { error: trackError } = await db.from("tracks").insert({
    id: trackId,
    code: `review-${suffix}`,
    name_ar: "اختبار ورد المراجعة",
    name_en: "Review queue browser test",
  });
  if (trackError) throw trackError;
  const { error: teacherTrackError } = await db
    .from("teacher_tracks")
    .insert({ teacher_id: teacherId, track_id: trackId });
  if (teacherTrackError) throw teacherTrackError;
  const { error: studentError } = await db.from("students").insert({
    id: studentId,
    full_name: studentName,
    gender: "male",
    timezone: "Africa/Cairo",
  });
  if (studentError) throw studentError;
  const { error: assignmentError } = await db.from("teacher_assignments").insert({
    id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    track_id: trackId,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Review queue browser test",
  });
  if (assignmentError) throw assignmentError;
  const { error: sessionError } = await db.from("sessions").insert({
    assignment_id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    scheduled_at: scheduledAt,
    ends_at: endsAt,
    duration_min: 30,
  });
  if (sessionError) throw sessionError;

  return { studentName, teacherEmail, teacherPassword };
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
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requiredTime(value: string | null) {
  if (!value) throw new Error("Could not create a valid review queue fixture time");
  return value;
}
