import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("US-070 and US-076 weekly schedules render in every role's local time", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/schedule");
  await page.locator("#schedule-assignment").selectOption(fixture.assignmentId);
  await page.locator("#schedule-weekday").selectOption("5");
  await page.locator("#schedule-time").fill("18:30");
  await page.locator("#schedule-duration").fill("45");
  await page.locator("#schedule-timezone").fill("Africa/Cairo");
  await page.getByRole("button", { name: "Add weekly time" }).click();
  await expect(page).toHaveURL(/scheduleStatus=saved$/);
  await expect(page.getByText("Weekly time saved.")).toBeVisible();

  await signInAs(page, "en", "teacher");
  await page.goto("/en/teacher/schedule");
  await expect(page.getByText("Schedule Student")).toBeVisible();
  await expect(page.getByText(/Friday · 18:30/)).toBeVisible();

  await signInAs(page, "en", "student");
  await page.goto("/en/student/schedule");
  await expect(page.getByText("Schedule Student")).toBeVisible();
  await expect(page.getByText(/Friday · 18:30/)).toBeVisible();

  await signInAs(page, "en", "parent");
  await page.goto("/en/parent/schedule");
  await expect(page.getByText("Schedule Student")).toBeVisible();
  await expect(page.getByText(/Friday · 16:30/)).toBeVisible();
  await expect(page.getByText(/Anchored to Africa\/Cairo/)).toBeVisible();
});

async function createFixture() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    },
  );
  const trackId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const studentId = await findOrCreateStudent(db);
  const teacherId = await findOrCreateTeacher(db, now);
  const guardianId = await findOrCreateGuardian(db);
  const writes = [
    db
      .from("profiles")
      .update({ timezone: "Asia/Riyadh" })
      .eq("id", "10000000-0000-4000-8000-000000000002"),
    db
      .from("profiles")
      .update({ timezone: "Africa/Cairo" })
      .eq("id", "10000000-0000-4000-8000-000000000003"),
    db
      .from("profiles")
      .update({ timezone: "Europe/London" })
      .eq("id", "10000000-0000-4000-8000-000000000004"),
    db.from("tracks").insert({
      id: trackId,
      code: `schedule-${trackId.slice(0, 8)}`,
      name_ar: "جدول",
      name_en: "Schedule",
    }),
  ];
  for (const write of writes) {
    const { error } = await write;
    if (error) throw error;
  }
  const { error: linksError } = await db
    .from("teacher_tracks")
    .insert({ teacher_id: teacherId, track_id: trackId });
  if (linksError) throw linksError;
  const { error: guardianError } = await db
    .from("student_guardians")
    .upsert(
      { student_id: studentId, guardian_id: guardianId, is_primary: true },
      { onConflict: "student_id,guardian_id" },
    );
  if (guardianError) throw guardianError;
  const { error: assignmentError } = await db.from("teacher_assignments").insert({
    id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    track_id: trackId,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Weekly schedule test",
  });
  if (assignmentError) throw assignmentError;
  return { assignmentId };
}

type FixtureClient = SupabaseClient<Database>;

async function findOrCreateTeacher(db: FixtureClient, now: string) {
  const profileId = "10000000-0000-4000-8000-000000000002";
  const { data } = await db.from("teachers").select("id").eq("profile_id", profileId).maybeSingle();
  if (data) {
    const { error } = await db
      .from("teachers")
      .update({
        status: "active",
        max_students: 5,
        identity_verified_at: now,
        code_of_conduct_accepted_at: now,
      })
      .eq("id", data.id);
    if (error) throw error;
    return data.id;
  }
  const id = crypto.randomUUID();
  const { error } = await db.from("teachers").insert({
    id,
    profile_id: profileId,
    gender: "male",
    max_students: 5,
    status: "active",
    identity_verified_at: now,
    code_of_conduct_accepted_at: now,
  });
  if (error) throw error;
  return id;
}

async function findOrCreateStudent(db: FixtureClient) {
  const profileId = "10000000-0000-4000-8000-000000000003";
  const { data } = await db.from("students").select("id").eq("profile_id", profileId).maybeSingle();
  if (data) {
    const { error } = await db
      .from("students")
      .update({
        full_name: "Schedule Student",
        gender: "male",
        timezone: "Africa/Cairo",
        status: "active",
      })
      .eq("id", data.id);
    if (error) throw error;
    return data.id;
  }
  const id = crypto.randomUUID();
  const { error } = await db.from("students").insert({
    id,
    profile_id: profileId,
    full_name: "Schedule Student",
    gender: "male",
    timezone: "Africa/Cairo",
  });
  if (error) throw error;
  return id;
}

async function findOrCreateGuardian(db: FixtureClient) {
  const profileId = "10000000-0000-4000-8000-000000000004";
  const { data } = await db
    .from("guardians")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (data) return data.id;
  const id = crypto.randomUUID();
  const { error } = await db.from("guardians").insert({ id, profile_id: profileId });
  if (error) throw error;
  return id;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
