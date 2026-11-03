import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("administration records and audits teacher attendance while teacher has read-only access", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/attendance");
  await expect(page.getByRole("heading", { name: "Teacher attendance register" })).toBeVisible();
  let card = page.locator("article").filter({ hasText: fixture.studentName });
  await expect(card).toBeVisible();
  await card.getByLabel("Teacher status").selectOption("late");
  await card.getByLabel("Minutes attended").fill("20");
  await card.getByRole("button", { name: "Record attendance" }).click();
  await expect(page).toHaveURL(/teacherAttendanceStatus=saved/);

  card = page.locator("article").filter({ hasText: fixture.studentName });
  await expect(card.locator('[data-slot="badge"]').filter({ hasText: "Late" })).toBeVisible();
  await card.getByLabel("Teacher status").selectOption("present");
  await card.getByLabel("Minutes attended").fill("30");
  await card.getByLabel("Administration note").fill("Corrected after attendance review");
  await card.getByRole("button", { name: "Save correction" }).click();
  card = page.locator("article").filter({ hasText: fixture.studentName });
  await expect(card.locator('[data-slot="badge"]').filter({ hasText: "Present" })).toBeVisible();

  const { data: saved, error: savedError } = await fixture.db
    .from("teacher_attendance")
    .select("id,status,note")
    .eq("session_id", fixture.sessionId)
    .single();
  if (savedError) throw savedError;
  expect(saved).toMatchObject({
    status: "present",
    note: "Corrected after attendance review",
  });
  const { count: auditCount, error: auditError } = await fixture.db
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("table_name", "teacher_attendance")
    .eq("record_id", saved.id);
  if (auditError) throw auditError;
  expect(auditCount).toBe(2);

  await signInAs(page, "en", "teacher");
  await page.goto("/en/teacher/profile?tab=attendance");
  const ownRegister = page.getByTestId("own-teacher-attendance-register");
  const ownEntry = ownRegister.locator("article").filter({ hasText: fixture.studentName });
  await expect(ownEntry).toBeVisible();
  await expect(
    ownEntry.locator('[data-slot="badge"]').filter({ hasText: "Present" }),
  ).toBeVisible();
  await expect(ownRegister.getByRole("button")).toHaveCount(0);

  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

async function createFixture() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const teacherProfileId = "10000000-0000-4000-8000-000000000002";
  const [{ data: teacher, error: teacherError }, { data: teacherTrack, error: trackError }] =
    await Promise.all([
      db.from("teachers").select("id,gender").eq("profile_id", teacherProfileId).single(),
      db
        .from("teacher_tracks")
        .select("teacher_id,track_id")
        .eq("teacher_id", "20000000-0000-4000-8000-000000000001")
        .limit(1)
        .maybeSingle(),
    ]);
  if (teacherError) throw teacherError;
  if (trackError) throw trackError;
  const track = teacherTrack ?? (await firstTeacherTrack(db, teacher.id));

  const studentId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const studentName = `Teacher register ${studentId.slice(0, 8)}`;
  const { error: studentError } = await db.from("students").insert({
    id: studentId,
    full_name: studentName,
    gender: teacher.gender,
    timezone: "Africa/Cairo",
  });
  if (studentError) throw studentError;
  const { error: assignmentError } = await db.from("teacher_assignments").insert({
    id: assignmentId,
    student_id: studentId,
    teacher_id: teacher.id,
    track_id: track.track_id,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Teacher attendance browser test",
  });
  if (assignmentError) throw assignmentError;

  const scheduledAt = await insertPastSession(db, {
    assignmentId,
    sessionId,
    studentId,
    teacherId: teacher.id,
  });
  return { db, sessionId, studentName, scheduledAt };
}

async function firstTeacherTrack(db: ReturnType<typeof createClient<Database>>, teacherId: string) {
  const { data, error } = await db
    .from("teacher_tracks")
    .select("teacher_id,track_id")
    .eq("teacher_id", teacherId)
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

async function insertPastSession(
  db: ReturnType<typeof createClient<Database>>,
  values: { assignmentId: string; sessionId: string; studentId: string; teacherId: string },
) {
  const day = DateTime.utc().minus({ days: 20 }).startOf("day");
  for (let hour = 0; hour < 24; hour += 1) {
    const scheduledAt = day.plus({ hours: hour }).toISO();
    if (!scheduledAt) continue;
    const { error } = await db.from("sessions").insert({
      id: values.sessionId,
      assignment_id: values.assignmentId,
      student_id: values.studentId,
      teacher_id: values.teacherId,
      scheduled_at: scheduledAt,
      ends_at: day.plus({ hours: hour, minutes: 30 }).toISO() ?? scheduledAt,
      duration_min: 30,
    });
    if (!error) return scheduledAt;
    if (error.code !== "23P01") throw error;
  }
  throw new Error("Could not find a free historical teacher session slot for the test.");
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
