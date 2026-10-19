import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("US-080/081 teacher records attendance in one click with atomic effects", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "teacher");
  await expect(page.getByRole("heading", { name: "My sessions today" })).toBeVisible();
  const sessionCard = page.locator("li").filter({ hasText: fixture.studentName });
  await expect(sessionCard).toBeVisible();
  await sessionCard.getByRole("button", { name: "Present" }).click();
  await expect(page).toHaveURL(/attendanceStatus=saved$/);
  await expect(
    page.getByText("Attendance was recorded and its credit and pay effects were applied."),
  ).toBeVisible();
  await expect(sessionCard.getByText("Present", { exact: true })).toBeVisible();
  await expect(sessionCard.getByRole("button", { name: "Present" })).toHaveCount(0);

  const [
    { data: attendance, error: attendanceError },
    { count: debitCount, error: debitError },
    { data: payout, error: payoutError },
  ] = await Promise.all([
    fixture.db.from("attendance").select("status").eq("session_id", fixture.sessionId).single(),
    fixture.db
      .from("session_credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("session_id", fixture.sessionId)
      .eq("reason", "consume"),
    fixture.db
      .from("teacher_payout_items")
      .select("teacher_id,amount,currency")
      .eq("session_id", fixture.sessionId)
      .single(),
  ]);
  if (attendanceError) throw attendanceError;
  if (debitError) throw debitError;
  if (payoutError) throw payoutError;
  expect(attendance.status).toBe("present");
  expect(debitCount).toBe(1);
  expect(payout).toMatchObject({ teacher_id: fixture.teacherId, amount: 125, currency: "EGP" });

  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

type Db = SupabaseClient<Database>;

async function createFixture() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const teacherId = await findOrCreateTeacher(db);
  const trackId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const studentName = `Attendance ${studentId.slice(0, 8)}`;
  const localNow = DateTime.now().setZone("Africa/Cairo");
  const scheduledDateTime = localNow.startOf("day").plus({ hours: 12 }).toUTC();
  const scheduledAt = requiredTime(scheduledDateTime.toISO());
  const endsAt = requiredTime(scheduledDateTime.plus({ minutes: 30 }).toISO());
  const periodStart = requiredTime(localNow.startOf("month").toISODate());
  const periodEnd = requiredTime(localNow.endOf("month").toISODate());
  const validFrom = requiredTime(localNow.minus({ months: 1 }).toISODate());

  const { error: trackError } = await db.from("tracks").insert({
    id: trackId,
    code: `attendance-${trackId.slice(0, 8)}`,
    name_ar: "اختبار حضور المتصفح",
    name_en: "Browser attendance test",
  });
  if (trackError) throw trackError;
  const { error: teacherTrackError } = await db
    .from("teacher_tracks")
    .upsert({ teacher_id: teacherId, track_id: trackId }, { onConflict: "teacher_id,track_id" });
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
    reason: "Attendance browser test",
  });
  if (assignmentError) throw assignmentError;
  const { error: subscriptionError } = await db.from("subscriptions").insert({
    id: subscriptionId,
    student_id: studentId,
    status: "active",
    start_date: periodStart,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    sessions_per_period: 4,
  });
  if (subscriptionError) throw subscriptionError;
  const { error: creditError } = await db.from("session_credit_ledger").insert({
    subscription_id: subscriptionId,
    delta: 4,
    reason: "grant",
    note: "attendance browser fixture",
  });
  if (creditError) throw creditError;
  const { error: rateError } = await db.from("teacher_rates").insert({
    teacher_id: teacherId,
    track_id: trackId,
    duration_min: 30,
    rate_per_session: 125,
    currency: "EGP",
    valid_from: validFrom,
    created_by: "10000000-0000-4000-8000-000000000001",
  });
  if (rateError) throw rateError;
  const { error: sessionError } = await db.from("sessions").insert({
    id: sessionId,
    assignment_id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    scheduled_at: scheduledAt,
    ends_at: endsAt,
    duration_min: 30,
  });
  if (sessionError) throw sessionError;

  return { db, sessionId, studentName, teacherId };
}

async function findOrCreateTeacher(db: Db) {
  const profileId = "10000000-0000-4000-8000-000000000002";
  const { data, error } = await db
    .from("teachers")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;
  const id = crypto.randomUUID();
  const timestamp = requiredTime(DateTime.utc().toISO());
  const { error: insertError } = await db.from("teachers").insert({
    id,
    profile_id: profileId,
    gender: "male",
    status: "active",
    identity_verified_at: timestamp,
    code_of_conduct_accepted_at: timestamp,
  });
  if (insertError) throw insertError;
  return id;
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requiredTime(value: string | null) {
  if (!value) throw new Error("Could not create a valid attendance fixture time");
  return value;
}
