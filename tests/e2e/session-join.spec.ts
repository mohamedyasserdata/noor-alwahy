import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import type { Database } from "../../types/database.types";

test("US-073 next-session card releases Zoom details only in the join window", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();
  try {
    await signIn(page, "en", fixture.studentEmail, fixture.password, "student/home");
    await expect(page.getByRole("heading", { name: "Your next session" })).toBeVisible();
    await expect(page.getByText("Available now")).toBeVisible();
    await expect(page.getByText("join-meeting-id")).toBeVisible();
    await expect(page.getByText("join-passcode")).toBeVisible();
    const studentJoin = page.getByRole("link", { name: "Join session" });
    await expect(studentJoin).toHaveAttribute("href", fixture.joinUrl);

    await signIn(page, "ar", fixture.parentEmail, fixture.password, "parent/children");
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
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = "AcademyTest1!";
  const studentEmail = `session-join-student-${suffix}@noor.local`;
  const parentEmail = `session-join-parent-${suffix}@noor.local`;
  const studentProfileId = await createAuthUser(db, studentEmail, password, "student");
  const parentProfileId = await createAuthUser(db, parentEmail, password, "parent");
  const teacher = await findTeacher(db);
  const studentId = crypto.randomUUID();
  const guardianId = crypto.randomUUID();
  const teacherId = teacher.id;
  const sessionId = crypto.randomUUID();
  const joinUrl = "https://academy.zoom.us/j/session-window";
  const scheduledAt = new Date(Date.now() + 5 * 60_000);
  const endsAt = new Date(scheduledAt.getTime() + 30 * 60_000);

  const { error: studentError } = await db.from("students").insert({
    id: studentId,
    profile_id: studentProfileId,
    full_name: `Join Window Student ${suffix}`,
    gender: "male",
    timezone: "Africa/Cairo",
  });
  if (studentError) throw studentError;
  const { error: guardianError } = await db
    .from("guardians")
    .insert({ id: guardianId, profile_id: parentProfileId });
  if (guardianError) throw guardianError;

  const { error: linkError } = await db
    .from("student_guardians")
    .upsert(
      { student_id: studentId, guardian_id: guardianId, is_primary: true },
      { onConflict: "student_id,guardian_id" },
    );
  if (linkError) throw linkError;

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
    parentEmail,
    password,
    studentEmail,
    async cleanup() {
      await db.from("sessions").delete().eq("id", sessionId);
      await db
        .from("student_guardians")
        .delete()
        .eq("student_id", studentId)
        .eq("guardian_id", guardianId);
      await db.from("students").delete().eq("id", studentId);
      await db.from("guardians").delete().eq("id", guardianId);
      await db.auth.admin.deleteUser(studentProfileId);
      await db.auth.admin.deleteUser(parentProfileId);
      if (teacher.created) await db.from("teachers").delete().eq("id", teacherId);
    },
  };
}

type Db = SupabaseClient<Database>;

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

async function createAuthUser(db: Db, email: string, password: string, role: "student" | "parent") {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: `Join Window ${role}`, role },
  });
  if (error) throw error;
  return data.user.id;
}

async function signIn(
  page: Page,
  locale: "ar" | "en",
  email: string,
  password: string,
  home: "student/home" | "parent/children",
) {
  await page.context().clearCookies();
  await page.goto(`/${locale}/auth/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/${home}(?:\\?.*)?$`));
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
