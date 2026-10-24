import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type { Database } from "../../types/database.types";

test("P4-T07 student navigates all Quran pages and receives locked progress live", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signIn(page, fixture.studentEmail, fixture.password);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/student/progress");

  await expect(page.getByRole("heading", { level: 1, name: "Quran progress map" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.locator("#quran-map-surah option")).toHaveCount(114);
  await expect(page.getByRole("button", { name: /^Juz / })).toHaveCount(30);
  const pageOne = page.getByRole("gridcell", { name: "Page 1: Not started" });
  await expect(pageOne).toBeVisible();
  await pageOne.focus();
  await pageOne.press("ArrowRight");
  const pageTwo = page.getByRole("gridcell", { name: "Page 2: Not started" });
  await expect(pageTwo).toBeFocused();
  await pageTwo.press("ArrowDown");
  await expect(page.getByRole("gridcell", { name: "Page 7: Not started" })).toBeFocused();
  await page.getByRole("gridcell", { name: "Page 7: Not started" }).press("Home");
  await expect(pageOne).toBeFocused();
  await pageOne.press("End");
  await expect(page.getByRole("gridcell", { name: "Page 604: Not started" })).toBeFocused();
  await expect(page.getByRole("heading", { level: 3, name: "Page 604" })).toBeVisible();

  await page.getByRole("gridcell", { name: "Page 604: Not started" }).press("Home");
  await expect(pageOne).toBeFocused();
  await expect(page.getByRole("grid", { name: "Quran pages progress grid" })).toHaveAttribute(
    "data-realtime-status",
    "subscribed",
  );
  await lockFirstPageEvaluation(fixture);
  await expect(page.getByRole("gridcell", { name: "Page 1: Mastered" })).toBeVisible({
    timeout: 15_000,
  });
  const details = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { level: 3, name: "Page 1" }) });
  await expect(details.getByText("Mastered", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ar/student/progress");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "خريطة تقدّم المصحف" })).toBeVisible();
  await expect(page.locator("#quran-map-surah option")).toHaveCount(114);
  await expect(page.getByRole("gridcell", { name: /الصفحة [١1]: متقن/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
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
  const assignmentId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const studentEmail = `quran-map-student-${suffix}@noor.local`;
  const teacherEmail = `quran-map-teacher-${suffix}@noor.local`;
  const timestamp = new Date().toISOString();

  for (const user of [
    {
      id: studentProfileId,
      email: studentEmail,
      role: "student",
      fullName: `Quran Map Student ${suffix}`,
    },
    {
      id: teacherProfileId,
      email: teacherEmail,
      role: "teacher",
      fullName: `Quran Map Teacher ${suffix}`,
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

  const writes = [
    db.from("students").insert({
      id: studentId,
      profile_id: studentProfileId,
      full_name: `Quran Map Student ${suffix}`,
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
      code: `quran-map-${suffix}`,
      name_ar: "اختبار خريطة المصحف",
      name_en: "Quran map browser test",
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
    id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    track_id: trackId,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Quran map browser test",
  });
  if (assignmentError) throw assignmentError;
  const { error: sessionError } = await db.from("sessions").insert({
    id: sessionId,
    assignment_id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    scheduled_at: "2040-01-10T08:00:00.000Z",
    ends_at: "2040-01-10T08:30:00.000Z",
    duration_min: 30,
    status: "held",
  });
  if (sessionError) throw sessionError;

  return {
    password,
    sessionId,
    studentEmail,
    studentId,
    teacherEmail,
    teacherProfileId,
  };
}

async function lockFirstPageEvaluation(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const db = databaseClient(required("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  const { error: authError } = await db.auth.signInWithPassword({
    email: fixture.teacherEmail,
    password: fixture.password,
  });
  if (authError) throw authError;
  const service = databaseClient(required("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: firstPage, error: pageError } = await service
    .from("quran_pages")
    .select("first_ayah_id,last_ayah_id")
    .eq("page", 1)
    .single();
  if (pageError) throw pageError;
  const { error } = await db.from("session_evaluations").insert({
    session_id: fixture.sessionId,
    session_type: "new_memo",
    from_ayah_id: firstPage.first_ayah_id,
    to_ayah_id: firstPage.last_ayah_id,
    pages: 1,
    scores: { memorization: 5 },
    decision: "passed",
    is_locked: true,
    created_by: fixture.teacherProfileId,
  });
  if (error) throw error;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/student\/home(?:\?.*)?$/);
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
