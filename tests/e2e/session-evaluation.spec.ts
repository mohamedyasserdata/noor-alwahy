import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("teacher restores a server draft on another device, reviews it, then publishes", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();
  const secondContext = await browser.newContext();
  try {
    await signInAs(page, "en", "teacher");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/en/teacher/sessions/${fixture.sessionId}`);
    await expect(page.getByTestId("teacher-session-workspace")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: `Session with ${fixture.studentName}` }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recitation & evaluation" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const firstCriterion = page.getByRole("radiogroup").first();
    const initialScore = firstCriterion.getByRole("radio", { checked: true });
    await initialScore.focus();
    await initialScore.press("End");
    await expect(firstCriterion.getByRole("radio", { name: "5 - Excellent" })).toBeChecked();
    await page.getByLabel("Homework").fill("Review Al-Fatihah twice");
    const excellentButtons = await page.getByRole("radio", { name: "5 - Excellent" }).all();
    for (const button of excellentButtons) await button.click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/evaluationStatus=draft/);
    await expect(page.getByText(/draft was saved in the system/i)).toBeVisible();

    const db = databaseClient();
    const { data: draftRow, error: draftError } = await db
      .from("session_evaluations")
      .select("is_locked,homework")
      .eq("session_id", fixture.sessionId)
      .single();
    if (draftError) throw draftError;
    expect(draftRow.is_locked).toBe(false);

    const studentDb = createClient<Database>(
      required("NEXT_PUBLIC_SUPABASE_URL"),
      required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    );
    const { error: loginError } = await studentDb.auth.signInWithPassword({
      email: fixture.studentEmail,
      password: fixture.studentPassword,
    });
    if (loginError) throw loginError;
    const hiddenDraft = await studentDb
      .from("session_evaluations")
      .select("id")
      .eq("session_id", fixture.sessionId)
      .maybeSingle();
    if (hiddenDraft.error) throw hiddenDraft.error;
    expect(hiddenDraft.data).toBeNull();

    const secondPage = await secondContext.newPage();
    await signInAs(secondPage, "en", "teacher");
    await secondPage.goto(`/en/teacher/sessions/${fixture.sessionId}`);
    await expect(secondPage.getByText(/system draft was restored/i)).toBeVisible();
    await expect(secondPage.getByLabel("Homework")).toHaveValue("Review Al-Fatihah twice");
    await secondPage.getByRole("button", { name: "Review evaluation" }).click();
    await expect(
      secondPage.getByRole("heading", { name: "Evaluation summary before final approval" }),
    ).toBeVisible();
    await expect(
      secondPage.getByRole("definition").filter({ hasText: "Review Al-Fatihah twice" }),
    ).toBeVisible();
    await secondPage.getByRole("button", { name: "Approve and publish" }).click();
    await expect(secondPage).toHaveURL(/evaluationStatus=saved/);
    await expect(secondPage.getByText(/evaluation was saved and locked/i)).toBeVisible();
    expect(
      await secondPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

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

    const visibleEvaluation = await studentDb
      .from("session_evaluations")
      .select("id,is_locked")
      .eq("session_id", fixture.sessionId)
      .single();
    if (visibleEvaluation.error) throw visibleEvaluation.error;
    expect(visibleEvaluation.data.is_locked).toBe(true);
  } finally {
    await secondContext.close();
    await fixture.cleanup();
  }
});

async function createFixture() {
  const db = databaseClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const studentName = `Evaluation Student ${suffix}`;
  const studentEmail = `evaluation.student.${suffix}@test.local`;
  const studentPassword = "AcademyTest1!";
  const studentUser = await createUser(db, studentEmail, studentName, studentPassword);
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
  const { error: attendanceError } = await db.from("attendance").insert({
    session_id: sessionId,
    student_id: studentId,
    status: "present",
    minutes: 30,
    recorded_by: "10000000-0000-4000-8000-000000000002",
    locked_at: now,
  });
  if (attendanceError) throw attendanceError;

  return {
    sessionId,
    studentEmail,
    studentName,
    studentPassword,
    async cleanup() {
      await db.from("session_evaluations").delete().eq("session_id", sessionId);
      await db.from("attendance").delete().eq("session_id", sessionId);
      await db.from("sessions").delete().eq("id", sessionId);
      await db.from("teacher_assignments").delete().eq("id", assignmentId);
      await db.from("students").delete().eq("id", studentId);
      await db.from("teacher_tracks").delete().eq("track_id", trackId).eq("teacher_id", teacherId);
      await db.from("tracks").delete().eq("id", trackId);
      await db.auth.admin.deleteUser(studentUser);
    },
  };
}

type FixtureClient = ReturnType<typeof databaseClient>;

async function createUser(db: FixtureClient, email: string, fullName: string, password: string) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
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
