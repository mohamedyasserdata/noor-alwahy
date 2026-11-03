import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { expect, test, type Page } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("administration adds and removes a student from a group session", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/schedule");
  let card = page.locator("article").filter({
    has: page.getByRole("heading", { name: fixture.primaryName, exact: true }),
  });
  await expect(card).toBeVisible();
  await card.getByLabel("Add a student assigned to this teacher").selectOption({
    label: fixture.secondaryName,
  });
  await card.getByRole("button", { name: "Add to session" }).click();
  await expect(page).toHaveURL(/adjustmentStatus=participant_added/);

  card = page.locator("article").filter({
    has: page.getByRole("heading", { name: fixture.primaryName, exact: true }),
  });
  await expect(card.getByText("Group session · 2 students", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("button", { name: `Remove ${fixture.secondaryName} from the session` }),
  ).toBeVisible();

  await card
    .getByRole("button", { name: `Remove ${fixture.secondaryName} from the session` })
    .click();
  await expect(page).toHaveURL(/adjustmentStatus=participant_removed/);
  card = page.locator("article").filter({
    has: page.getByRole("heading", { name: fixture.primaryName, exact: true }),
  });
  await expect(card.getByText("Individual session", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("button", { name: `Remove ${fixture.secondaryName} from the session` }),
  ).toHaveCount(0);

  const { count, error } = await fixture.db
    .from("session_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", fixture.sessionId);
  if (error) throw error;
  expect(count).toBe(1);

  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("teacher records and corrects each group participant attendance independently", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/schedule");
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: fixture.primaryName, exact: true }),
  });
  await card.getByLabel("Add a student assigned to this teacher").selectOption({
    label: fixture.secondaryName,
  });
  await card.getByRole("button", { name: "Add to session" }).click();
  await expect(page).toHaveURL(/adjustmentStatus=participant_added/);

  await signIn(page, fixture.teacherEmail, fixture.teacherPassword);
  await page.goto(`/en/teacher/sessions/${fixture.sessionId}`);
  await expect(page.getByRole("heading", { name: "Group session · 2 students" })).toBeVisible();

  let primaryAttendance = page.getByTestId(`student-attendance-${fixture.primaryId}`);
  await expect(primaryAttendance.getByText(fixture.primaryName, { exact: true })).toBeVisible();
  await primaryAttendance.getByRole("button", { name: "Present" }).click();
  await expect(page).toHaveURL(/attendanceStatus=saved/);

  primaryAttendance = page.getByTestId(`student-attendance-${fixture.primaryId}`);
  await primaryAttendance.getByText("Change attendance", { exact: true }).click();
  await primaryAttendance.getByLabel("Student attendance").selectOption("late");
  await primaryAttendance
    .getByLabel("Correction reason")
    .fill("Student joined after the initial attendance check");
  await primaryAttendance.getByRole("button", { name: "Save correction" }).click();
  await expect(page).toHaveURL(/attendanceStatus=saved/);

  const secondaryAttendance = page.getByTestId(`student-attendance-${fixture.secondaryId}`);
  await expect(secondaryAttendance.getByText(fixture.secondaryName, { exact: true })).toBeVisible();
  await secondaryAttendance.getByRole("button", { name: "Absent" }).click();
  await expect
    .poll(async () => {
      const { data, error } = await fixture.db
        .from("attendance")
        .select("status")
        .eq("session_id", fixture.sessionId)
        .eq("student_id", fixture.secondaryId)
        .maybeSingle();
      if (error) throw error;
      return data?.status;
    })
    .toBe("student_absent");

  const { data: attendanceRows, error: attendanceError } = await fixture.db
    .from("attendance")
    .select("student_id,status,correction_reason")
    .eq("session_id", fixture.sessionId)
    .order("student_id");
  if (attendanceError) throw attendanceError;
  expect(attendanceRows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        student_id: fixture.primaryId,
        status: "late",
        correction_reason: "Student joined after the initial attendance check",
      }),
      expect.objectContaining({
        student_id: fixture.secondaryId,
        status: "student_absent",
      }),
    ]),
  );

  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

async function createFixture() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const teacherPassword = "AcademyTest1!";
  const teacherEmail = `group-teacher-${crypto.randomUUID()}@noor.local`;
  const teacherProfileId = crypto.randomUUID();
  const teacherId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const timestamp = DateTime.utc().toISO();
  if (!timestamp) throw new Error("Could not create the teacher fixture timestamp.");
  const { error: userError } = await db.auth.admin.createUser({
    id: teacherProfileId,
    email: teacherEmail,
    password: teacherPassword,
    email_confirm: true,
    app_metadata: { role: "teacher" },
    user_metadata: { full_name: `Group teacher ${teacherId.slice(0, 8)}`, role: "teacher" },
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
    code: `group-ui-${trackId.slice(0, 8)}`,
    name_ar: "اختبار الحصة الجماعية",
    name_en: "Group session browser test",
  });
  if (trackError) throw trackError;
  const { error: teacherTrackError } = await db
    .from("teacher_tracks")
    .insert({ teacher_id: teacherId, track_id: trackId });
  if (teacherTrackError) throw teacherTrackError;

  const primaryId = crypto.randomUUID();
  const secondaryId = crypto.randomUUID();
  const primaryAssignmentId = crypto.randomUUID();
  const secondaryAssignmentId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const primaryName = `Group primary ${primaryId.slice(0, 8)}`;
  const secondaryName = `Group secondary ${secondaryId.slice(0, 8)}`;
  const { error: studentsError } = await db.from("students").insert([
    {
      id: primaryId,
      full_name: primaryName,
      gender: "male",
      timezone: "Africa/Cairo",
    },
    {
      id: secondaryId,
      full_name: secondaryName,
      gender: "male",
      timezone: "Africa/Cairo",
    },
  ]);
  if (studentsError) throw studentsError;
  const { error: assignmentsError } = await db.from("teacher_assignments").insert([
    {
      id: primaryAssignmentId,
      student_id: primaryId,
      teacher_id: teacherId,
      track_id: trackId,
      assigned_by: "10000000-0000-4000-8000-000000000001",
      reason: "Group session primary browser test",
    },
    {
      id: secondaryAssignmentId,
      student_id: secondaryId,
      teacher_id: teacherId,
      track_id: trackId,
      assigned_by: "10000000-0000-4000-8000-000000000001",
      reason: "Group session secondary browser test",
    },
  ]);
  if (assignmentsError) throw assignmentsError;

  const start = DateTime.utc().plus({ days: 12 }).startOf("day");
  for (let hour = 0; hour < 24; hour += 1) {
    const scheduledAt = start.plus({ hours: hour }).toISO();
    if (!scheduledAt) continue;
    const { error } = await db.from("sessions").insert({
      id: sessionId,
      assignment_id: primaryAssignmentId,
      student_id: primaryId,
      teacher_id: teacherId,
      scheduled_at: scheduledAt,
      ends_at: start.plus({ hours: hour, minutes: 30 }).toISO() ?? scheduledAt,
      duration_min: 30,
    });
    if (!error) {
      return {
        db,
        primaryId,
        primaryName,
        secondaryId,
        secondaryName,
        sessionId,
        teacherEmail,
        teacherPassword,
      };
    }
    if (error.code !== "23P01") throw error;
  }
  throw new Error("Could not find a free future session slot for the group session test.");
}

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/teacher\/today(?:\?.*)?$/, { timeout: 15_000 });
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
