import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("P4-T04 teacher restores a local draft and locks a mobile session evaluation", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "teacher");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/en/teacher/evaluations?sessionId=${fixture.sessionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Session evaluation" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: fixture.studentName })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const startedAt = Date.now();
  await page.getByLabel("Homework").fill("Review Al-Fatihah twice");
  await page.reload();
  await expect(page.getByText("Your draft on this device was restored.")).toBeVisible();
  await expect(page.getByLabel("Homework")).toHaveValue("Review Al-Fatihah twice");

  const excellentButtons = await page.getByRole("radio", { name: "5 - Excellent" }).all();
  for (const button of excellentButtons) await button.click();
  await page.getByRole("button", { name: "Save and lock evaluation" }).click();

  await expect(page).toHaveURL(/evaluationStatus=saved/);
  await expect(page.getByText(/evaluation was saved and locked/i)).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(120_000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const db = databaseClient();
  const { data, error } = await db
    .from("session_evaluations")
    .select("is_locked,total_score,rating,from_ayah_id,to_ayah_id,homework")
    .eq("session_id", fixture.sessionId)
    .single();
  if (error) throw error;
  expect(data.is_locked).toBe(true);
  expect(data.total_score).toBe(100);
  expect(data.rating).toBe(5);
  expect(data.from_ayah_id).toBe(1);
  expect(data.to_ayah_id).toBe(7);
  expect(data.homework).toEqual({ text: "Review Al-Fatihah twice" });
});

async function createFixture() {
  const db = databaseClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const studentName = `Evaluation Student ${suffix}`;
  const studentUser = await createUser(db, `evaluation.student.${suffix}@test.local`, studentName);
  const trackId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  let teacherId: string;
  const { data: existingTeacher, error: teacherReadError } = await db
    .from("teachers")
    .select("id")
    .eq("profile_id", "10000000-0000-4000-8000-000000000002")
    .maybeSingle();
  if (teacherReadError) throw teacherReadError;
  if (existingTeacher) {
    teacherId = existingTeacher.id;
  } else {
    teacherId = crypto.randomUUID();
    const { error } = await db.from("teachers").insert({
      id: teacherId,
      profile_id: "10000000-0000-4000-8000-000000000002",
      gender: "male",
      status: "active",
      identity_verified_at: now,
      code_of_conduct_accepted_at: now,
    });
    if (error) throw error;
  }

  const writes = [
    db.from("tracks").insert({
      id: trackId,
      code: `evaluation-${suffix}`,
      name_ar: "اختبار تقييم",
      name_en: "Evaluation test",
    }),
    db.from("students").insert({
      id: studentId,
      profile_id: studentUser,
      full_name: studentName,
      gender: "male",
      timezone: "Africa/Cairo",
    }),
  ];
  for (const write of writes) {
    const { error } = await write;
    if (error) throw error;
  }
  const { error: trackError } = await db
    .from("teacher_tracks")
    .upsert({ teacher_id: teacherId, track_id: trackId });
  if (trackError) throw trackError;
  const { error: assignmentError } = await db.from("teacher_assignments").insert({
    id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    track_id: trackId,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Evaluation browser test",
  });
  if (assignmentError) throw assignmentError;
  const day = 1 + (Number.parseInt(suffix.slice(0, 2), 16) % 25);
  const scheduledAt = new Date(Date.UTC(2040, 0, day, 8, 0)).toISOString();
  const { error: sessionError } = await db.from("sessions").insert({
    id: sessionId,
    assignment_id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    scheduled_at: scheduledAt,
    duration_min: 30,
    ends_at: new Date(Date.parse(scheduledAt) + 30 * 60_000).toISOString(),
    status: "held",
  });
  if (sessionError) throw sessionError;

  return { sessionId, studentName };
}

type FixtureClient = ReturnType<typeof databaseClient>;

async function createUser(db: FixtureClient, email: string, fullName: string) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "AcademyTest1!",
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

function databaseClient() {
  return createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
