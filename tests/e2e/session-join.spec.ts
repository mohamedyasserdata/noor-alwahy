import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("US-073 next-session card releases Zoom details only in the join window", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();
  try {
    await signInAs(page, "en", "student");
    await expect(page.getByRole("heading", { name: "Your next session" })).toBeVisible();
    await expect(page.getByText("Available now")).toBeVisible();
    await expect(page.getByText("join-meeting-id")).toBeVisible();
    await expect(page.getByText("join-passcode")).toBeVisible();
    const studentJoin = page.getByRole("link", { name: "Join session" });
    await expect(studentJoin).toHaveAttribute("href", fixture.joinUrl);

    await signInAs(page, "ar", "parent");
    await expect(page.getByRole("heading", { name: "حصتك القادمة" })).toBeVisible();
    await expect(page.getByText("متاحة الآن")).toBeVisible();
    await expect(page.getByText("join-meeting-id")).toBeVisible();
    await expect(page.getByRole("link", { name: "الانضمام إلى الحصة" })).toHaveAttribute(
      "href",
      fixture.joinUrl,
    );

    await page.setViewportSize({ width: 360, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  } finally {
    await fixture.cleanup();
  }
});

async function createFixture() {
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const student = await findStudent(db);
  const teacher = await findTeacher(db);
  const guardian = await findGuardian(db);
  const studentId = student.id;
  const teacherId = teacher.id;
  const guardianId = guardian.id;
  const sessionId = crypto.randomUUID();
  const joinUrl = "https://academy.zoom.us/j/session-window";
  const scheduledAt = new Date(Date.now() + 5 * 60_000);
  const endsAt = new Date(scheduledAt.getTime() + 30 * 60_000);

  const { error: linkError } = await db
    .from("student_guardians")
    .upsert(
      { student_id: studentId, guardian_id: guardianId, is_primary: true },
      { onConflict: "student_id,guardian_id" },
    );
  if (linkError) throw linkError;

  const { error: cleanupError } = await db
    .from("sessions")
    .delete()
    .or(`student_id.eq.${studentId},teacher_id.eq.${teacherId}`);
  if (cleanupError) throw cleanupError;

  const { error: sessionError } = await db.from("sessions").insert({
    id: sessionId,
    student_id: studentId,
    teacher_id: teacherId,
    scheduled_at: scheduledAt.toISOString(),
    ends_at: endsAt.toISOString(),
    duration_min: 30,
    zoom_override_url: joinUrl,
    zoom_meeting_id: "join-meeting-id",
    zoom_passcode: "join-passcode",
  });
  if (sessionError) throw sessionError;
  return {
    joinUrl,
    async cleanup() {
      await db.from("sessions").delete().eq("id", sessionId);
      await db
        .from("student_guardians")
        .delete()
        .eq("student_id", studentId)
        .eq("guardian_id", guardianId);
      if (student.created) await db.from("students").delete().eq("id", studentId);
      if (teacher.created) await db.from("teachers").delete().eq("id", teacherId);
      if (guardian.created) await db.from("guardians").delete().eq("id", guardianId);
    },
  };
}

type Db = SupabaseClient<Database>;

async function findStudent(db: Db) {
  const profileId = "10000000-0000-4000-8000-000000000003";
  const { data, error } = await db
    .from("students")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (data) return { id: data.id, created: false };
  const id = crypto.randomUUID();
  const { error: insertError } = await db.from("students").insert({
    id,
    profile_id: profileId,
    full_name: "Join Window Student",
    gender: "male",
    timezone: "Africa/Cairo",
  });
  if (insertError) throw insertError;
  return { id, created: true };
}

async function findTeacher(db: Db) {
  const profileId = "10000000-0000-4000-8000-000000000002";
  const { data, error } = await db
    .from("teachers")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (data) return { id: data.id, created: false };
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const { error: insertError } = await db.from("teachers").insert({
    id,
    profile_id: profileId,
    gender: "male",
    status: "active",
    identity_verified_at: timestamp,
    code_of_conduct_accepted_at: timestamp,
  });
  if (insertError) throw insertError;
  return { id, created: true };
}

async function findGuardian(db: Db) {
  const profileId = "10000000-0000-4000-8000-000000000004";
  const { data, error } = await db
    .from("guardians")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (data) return { id: data.id, created: false };
  const id = crypto.randomUUID();
  const { error: insertError } = await db.from("guardians").insert({ id, profile_id: profileId });
  if (insertError) throw insertError;
  return { id, created: true };
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
