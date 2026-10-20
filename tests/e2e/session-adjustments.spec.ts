import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("P3-T06 admin approves substitute, reschedule, and linked makeup", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/schedule");
  await expect(page.getByRole("heading", { name: "Upcoming session approvals" })).toBeVisible();
  await expect(
    page
      .locator(`#substitute-${fixture.sessionId}`)
      .locator("xpath=ancestor::article")
      .getByText(fixture.studentName),
  ).toBeVisible();

  const substituteForm = page.locator(`#substitute-${fixture.sessionId}`).locator("..");
  await substituteForm
    .locator("select[name=substituteTeacherId]")
    .selectOption(fixture.substituteId);
  await substituteForm.getByRole("button", { name: "Approve substitute" }).click();
  await expect(page).toHaveURL(/adjustmentStatus=substitute_saved$/);
  await expect(page.getByText(/substitute was approved/i)).toBeVisible();

  const db = databaseClient();
  const { data: substituted, error: substituteError } = await db
    .from("sessions")
    .select("teacher_id,original_teacher_id")
    .eq("id", fixture.sessionId)
    .single();
  if (substituteError) throw substituteError;
  expect(substituted.teacher_id).toBe(fixture.substituteId);
  expect(substituted.original_teacher_id).toBe(fixture.originalTeacherId);

  const rescheduleInput = page.locator(`#reschedule-${fixture.sessionId}`);
  await rescheduleInput.fill("2030-04-02T18:30");
  await rescheduleInput
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Approve new time" })
    .click();
  await expect(page).toHaveURL(/adjustmentStatus=rescheduled$/);
  await expect(page.getByText(/replacement time was created/i)).toBeVisible();

  const { data: source, error: sourceError } = await db
    .from("sessions")
    .select("status")
    .eq("id", fixture.sessionId)
    .single();
  if (sourceError) throw sourceError;
  expect(source.status).toBe("rescheduled");
  const { data: replacement, error: replacementError } = await db
    .from("sessions")
    .select("id,status")
    .eq("rescheduled_from", fixture.sessionId)
    .single();
  if (replacementError) throw replacementError;
  expect(replacement.status).toBe("scheduled");

  const makeupInput = page.locator(`#makeup-time-${fixture.entitlementId}`);
  await makeupInput.fill("2030-04-03T18:30");
  await makeupInput
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Create makeup session" })
    .click();
  await expect(page).toHaveURL(/adjustmentStatus=makeup_saved$/);
  await expect(page.getByText(/makeup session was created/i)).toBeVisible();

  const { data: entitlement, error: entitlementError } = await db
    .from("makeup_entitlements")
    .select("used_by_session_id")
    .eq("id", fixture.entitlementId)
    .single();
  if (entitlementError) throw entitlementError;
  expect(entitlement.used_by_session_id).not.toBeNull();

  await page.setViewportSize({ width: 360, height: 800 });
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

async function createFixture() {
  const db = databaseClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const studentName = `Adjustment Student ${suffix}`;
  const [originalUser, substituteUser, studentUser] = await Promise.all([
    createUser(db, `adjustment.original.${suffix}@test.local`, "teacher", `Original ${suffix}`),
    createUser(db, `adjustment.substitute.${suffix}@test.local`, "teacher", `Substitute ${suffix}`),
    createUser(db, `adjustment.student.${suffix}@test.local`, "student", studentName),
  ]);
  const trackId = crypto.randomUUID();
  const originalTeacherId = crypto.randomUUID();
  const substituteId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const sourceSessionId = crypto.randomUUID();
  const entitlementId = crypto.randomUUID();
  const now = new Date().toISOString();

  for (const write of [
    db.from("tracks").insert({
      id: trackId,
      code: `adjustment-${suffix}`,
      name_ar: "تعديل حصة",
      name_en: "Session adjustment",
    }),
    db.from("teachers").insert([
      {
        id: originalTeacherId,
        profile_id: originalUser,
        gender: "male",
        status: "active",
        identity_verified_at: now,
        code_of_conduct_accepted_at: now,
      },
      {
        id: substituteId,
        profile_id: substituteUser,
        gender: "male",
        status: "active",
        identity_verified_at: now,
        code_of_conduct_accepted_at: now,
      },
    ]),
    db.from("students").insert({
      id: studentId,
      profile_id: studentUser,
      full_name: studentName,
      gender: "male",
      timezone: "Africa/Cairo",
    }),
  ]) {
    const { error } = await write;
    if (error) throw error;
  }

  for (const write of [
    db.from("teacher_tracks").insert([
      { teacher_id: originalTeacherId, track_id: trackId },
      { teacher_id: substituteId, track_id: trackId },
    ]),
    db.from("teacher_assignments").insert({
      id: assignmentId,
      student_id: studentId,
      teacher_id: originalTeacherId,
      track_id: trackId,
      assigned_by: "10000000-0000-4000-8000-000000000001",
      reason: "Session adjustment browser test",
    }),
    db.from("subscriptions").insert({
      id: subscriptionId,
      student_id: studentId,
      status: "active",
      start_date: "2030-01-01",
      current_period_start: "2030-01-01",
      current_period_end: "2030-12-31",
      sessions_per_period: 20,
    }),
  ]) {
    const { error } = await write;
    if (error) throw error;
  }

  const { error: sessionError } = await db.from("sessions").insert([
    {
      id: sessionId,
      assignment_id: assignmentId,
      student_id: studentId,
      teacher_id: originalTeacherId,
      scheduled_at: "2030-04-01T16:00:00.000Z",
      duration_min: 30,
      ends_at: "2030-04-01T16:30:00.000Z",
      status: "scheduled",
    },
    {
      id: sourceSessionId,
      assignment_id: assignmentId,
      student_id: studentId,
      teacher_id: originalTeacherId,
      scheduled_at: "2030-03-01T16:00:00.000Z",
      duration_min: 30,
      ends_at: "2030-03-01T16:30:00.000Z",
      status: "cancelled",
    },
  ]);
  if (sessionError) throw sessionError;

  const { error: entitlementError } = await db.from("makeup_entitlements").insert({
    id: entitlementId,
    subscription_id: subscriptionId,
    student_id: studentId,
    source_session_id: sourceSessionId,
    outside_period_cap: true,
    expires_at: "2030-12-31T00:00:00.000Z",
  });
  if (entitlementError) throw entitlementError;

  return { entitlementId, originalTeacherId, sessionId, studentName, substituteId };
}

type FixtureClient = ReturnType<typeof databaseClient>;

async function createUser(
  db: FixtureClient,
  email: string,
  role: "teacher" | "student",
  fullName: string,
) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "AcademyTest1!",
    email_confirm: true,
    app_metadata: { role },
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
