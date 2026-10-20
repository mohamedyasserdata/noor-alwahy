import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("P3-T07 administrator reviews daily attendance adherence", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createReportFixture();

  await signInAs(page, "en", "admin");
  await page.goto(`/en/admin/attendance?period=daily&anchor=${fixture.anchor}`);

  await expect(page.getByRole("heading", { name: "Attendance reports" })).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: fixture.studentName })
      .getByText("100%", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: fixture.teacherName })
      .getByText("100%", { exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => ({
    present: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8)
      .map((element) => ({
        className: element.className,
        inlineEnd: Math.round(element.getBoundingClientRect().right),
        tag: element.tagName,
      })),
  }));
  expect(overflow.present, JSON.stringify(overflow.offenders)).toBe(false);
});

async function createReportFixture() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    },
  );
  const suffix = crypto.randomUUID().slice(0, 8);
  const teacherProfileId = crypto.randomUUID();
  const teacherId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const teacherName = `Report Teacher ${suffix}`;
  const studentName = `Report Student ${suffix}`;
  const localDay = DateTime.now().setZone("Africa/Cairo").startOf("day");
  const scheduledAt = requiredTime(localDay.plus({ hours: 10 }).toUTC().toISO());
  const endsAt = requiredTime(localDay.plus({ hours: 10, minutes: 30 }).toUTC().toISO());
  const anchor = requiredTime(localDay.toISODate());

  const { error: userError } = await db.auth.admin.createUser({
    id: teacherProfileId,
    email: `report.teacher.${suffix}@test.local`,
    password: "AcademyTest1!",
    email_confirm: true,
    app_metadata: { role: "teacher" },
    user_metadata: { full_name: teacherName, role: "teacher" },
  });
  if (userError) throw userError;

  for (const write of [
    db.from("tracks").insert({
      id: trackId,
      code: `report-${suffix}`,
      name_ar: "تقرير حضور",
      name_en: "Attendance report",
    }),
    db.from("teachers").insert({
      id: teacherId,
      profile_id: teacherProfileId,
      gender: "male",
      status: "active",
      identity_verified_at: new Date().toISOString(),
      code_of_conduct_accepted_at: new Date().toISOString(),
    }),
    db.from("students").insert({
      id: studentId,
      full_name: studentName,
      gender: "male",
      timezone: "Africa/Cairo",
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
    id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    track_id: trackId,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Attendance report browser test",
  });
  if (assignmentError) throw assignmentError;

  const { error: sessionError } = await db.from("sessions").insert({
    id: sessionId,
    assignment_id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    original_teacher_id: teacherId,
    scheduled_at: scheduledAt,
    ends_at: endsAt,
    duration_min: 30,
    status: "held",
  });
  if (sessionError) throw sessionError;

  const { error: attendanceError } = await db.from("attendance").insert({
    session_id: sessionId,
    status: "present",
    minutes: 30,
    recorded_by: "10000000-0000-4000-8000-000000000001",
    locked_at: DateTime.fromISO(endsAt).plus({ hours: 48 }).toISO(),
  });
  if (attendanceError) throw attendanceError;

  return { anchor, studentName, teacherName };
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function requiredTime(value: string | null) {
  if (!value) throw new Error("Could not create a valid attendance report fixture time");
  return value;
}
