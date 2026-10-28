import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("sensitive actions require a contextual review before the server mutation", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const db = databaseClient();
  const suffix = randomUUID().slice(0, 8);
  const email = `confirmation-${suffix}@noor.local`;
  const profileId = randomUUID();
  const teacherProfileId = randomUUID();
  const teacherId = randomUUID();
  const studentProfileId = randomUUID();
  const studentId = randomUUID();
  const trackId = randomUUID();
  const teacherEmail = `confirmation-teacher-${suffix}@noor.local`;
  const studentName = `Confirmation Report Student ${suffix}`;
  let reportId: string | null = null;

  const { error: userError } = await db.auth.admin.createUser({
    id: profileId,
    email,
    password: "AcademyTest1!",
    email_confirm: true,
    app_metadata: { role: "student" },
    user_metadata: { full_name: `Confirmation Student ${suffix}`, role: "student" },
  });
  if (userError) throw userError;

  for (const user of [
    {
      id: teacherProfileId,
      email: teacherEmail,
      role: "teacher",
      name: `Confirmation Teacher ${suffix}`,
    },
    {
      id: studentProfileId,
      email: `confirmation-student-${suffix}@noor.local`,
      role: "student",
      name: studentName,
    },
  ]) {
    const { error } = await db.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: "AcademyTest1!",
      email_confirm: true,
      app_metadata: { role: user.role },
      user_metadata: { full_name: user.name, role: user.role },
    });
    if (error) throw error;
  }
  const timestamp = new Date().toISOString();
  for (const write of [
    db.from("teachers").insert({
      id: teacherId,
      profile_id: teacherProfileId,
      gender: "male",
      status: "active",
      identity_verified_at: timestamp,
      code_of_conduct_accepted_at: timestamp,
    }),
    db.from("students").insert({
      id: studentId,
      profile_id: studentProfileId,
      full_name: studentName,
      gender: "male",
      timezone: "Africa/Cairo",
    }),
    db.from("tracks").insert({
      id: trackId,
      code: `confirm-${suffix}`,
      name_ar: "مسار اختبار التأكيد",
      name_en: "Confirmation test track",
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
    student_id: studentId,
    teacher_id: teacherId,
    track_id: trackId,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Sensitive action confirmation browser gate",
  });
  if (assignmentError) throw assignmentError;

  try {
    const periodStart = randomPeriodStart(suffix);
    const periodEnd = new Date(`${periodStart}T12:00:00Z`);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);

    await signIn(page, teacherEmail, "AcademyTest1!", "/en/teacher/today");
    await page.goto("/en/teacher/reports");
    const studentSelect = page.locator('select[name="studentId"]').first();
    await studentSelect.selectOption(studentId);
    await page.getByLabel("Period start").first().fill(periodStart);
    await page.getByLabel("Period end").first().fill(periodEnd.toISOString().slice(0, 10));
    await page.getByLabel("Progress summary").first().fill("Confirmation review fixture");
    await page.getByLabel("Strengths").first().fill("Structured fixture");
    await page.getByLabel("Areas to improve").first().fill("Continue the current plan");
    await page.getByLabel("Next-period plan").first().fill("Continue");
    await page.getByLabel("Recommendation for student and guardian").first().fill("Continue");
    await page.getByRole("button", { name: "Save draft" }).first().click();
    await expect(page).toHaveURL(/reportStatus=saved/);
    const teacherReportCard = page
      .locator("article")
      .filter({ hasText: studentName })
      .filter({ hasText: periodStart });
    await teacherReportCard.getByRole("button", { name: "Approve report" }).click();
    await expect(page).toHaveURL(/reportStatus=approved/);

    const { data: createdReport, error: createdReportError } = await db
      .from("reports")
      .select("id")
      .eq("student_id", studentId)
      .eq("period_start", periodStart)
      .single();
    if (createdReportError) throw createdReportError;
    reportId = createdReport.id;

    await signInAs(page, "en", "admin");

    await page.goto("/en/admin/users");
    const accountCard = page.locator("div.rounded-2xl").filter({ hasText: email });
    await accountCard.getByRole("button", { name: "Disable" }).click();
    const disableDialog = page.getByRole("dialog", { name: "Disable this account?" });
    await expect(disableDialog).toContainText(email);
    await expect.poll(() => accountActive(db, profileId)).toBe(true);
    await disableDialog.getByRole("button", { name: "Disable" }).click();
    await expect.poll(() => accountActive(db, profileId)).toBe(false);
    await expect(
      page.locator("div.rounded-2xl").filter({ hasText: email }).getByRole("button", {
        name: "Activate",
      }),
    ).toBeVisible();

    await page.goto("/en/admin/reports");
    const reportCard = page
      .locator("article")
      .filter({ hasText: studentName })
      .filter({ hasText: periodStart });
    await reportCard.getByRole("button", { name: "Publish to family" }).click();
    const publishDialog = page.getByRole("dialog", { name: "Publish this report?" });
    await expect(publishDialog).toContainText(studentName);
    await expect(publishDialog).toContainText("Student and linked guardians");
    await expect.poll(() => reportStatus(db, reportId!)).toBe("approved");
    await publishDialog.getByRole("button", { name: "Publish to family" }).click();
    await expect.poll(() => reportStatus(db, reportId!)).toBe("visible");
  } finally {
    await db.auth.admin.deleteUser(profileId);
  }
});

async function signIn(
  page: Parameters<typeof signInAs>[0],
  email: string,
  password: string,
  home: string,
) {
  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`${home}(?:\\?.*)?$`), { timeout: 20_000 });
}

async function accountActive(db: ReturnType<typeof databaseClient>, profileId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("is_active")
    .eq("id", profileId)
    .single();
  if (error) throw error;
  return data.is_active;
}

async function reportStatus(db: ReturnType<typeof databaseClient>, reportId: string) {
  const { data, error } = await db.from("reports").select("status").eq("id", reportId).single();
  if (error) throw error;
  return data.status;
}

function randomPeriodStart(seed: string) {
  const numeric = Number.parseInt(seed.slice(0, 6), 16);
  const date = new Date(Date.UTC(2024, 0, 1));
  date.setUTCDate(date.getUTCDate() + (numeric % 650));
  return date.toISOString().slice(0, 10);
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
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
