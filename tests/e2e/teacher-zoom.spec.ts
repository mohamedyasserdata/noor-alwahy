import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("teacher reviews, publishes, and unpublishes Zoom for one session only", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();
  try {
    await signInAs(page, "en", "teacher");
    await page.goto(`/en/teacher/sessions/${fixture.sessionId}`);
    await expect(page.getByTestId("teacher-session-workspace")).toBeVisible();
    await expect(page.getByText("Not published", { exact: true })).toBeVisible();
    await expect(page.getByText("Administration records teacher attendance.")).toBeVisible();

    await page.getByText("Review link publication", { exact: true }).click();
    await page.locator("#session-zoom-url").fill(fixture.joinUrl);
    await expect(page.getByText("This student only", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Publish for this session" }).click();
    await expect(page).toHaveURL(/zoomStatus=publish$/);
    await expect(page.getByText("Published to the authorized student")).toBeVisible();

    await signInAs(page, "en", "student");
    await expect(page.getByRole("link", { name: "Join session" })).toHaveAttribute(
      "href",
      fixture.joinUrl,
    );

    await signInAs(page, "en", "teacher");
    await page.goto(`/en/teacher/sessions/${fixture.sessionId}`);
    await page.getByText("Review unpublishing", { exact: true }).click();
    await page.getByRole("button", { name: "Unpublish link" }).click();
    await expect(page).toHaveURL(/zoomStatus=unpublish$/);
    await expect(page.getByText("Not published", { exact: true })).toBeVisible();

    await signInAs(page, "en", "student");
    await expect(page.getByRole("link", { name: "Join session" })).toHaveCount(0);

    await signInAs(page, "ar", "teacher");
    await page.goto(`/ar/teacher/sessions/${fixture.sessionId}`);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(
      page.getByRole("heading", { name: new RegExp(fixture.studentName) }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
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
  const [
    { data: teacher, error: teacherError },
    { data: student, error: studentError },
    { data: track, error: trackError },
  ] = await Promise.all([
    db
      .from("teachers")
      .select("id")
      .eq("profile_id", "10000000-0000-4000-8000-000000000002")
      .single(),
    db
      .from("students")
      .select("id,full_name")
      .eq("profile_id", "10000000-0000-4000-8000-000000000003")
      .single(),
    db.from("tracks").select("id").eq("is_active", true).limit(1).single(),
  ]);
  if (teacherError) throw teacherError;
  if (studentError) throw studentError;
  if (trackError) throw trackError;

  const sessionId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const scheduledAt = new Date(Date.now() + 5 * 60_000);
  const endsAt = new Date(scheduledAt.getTime() + 30 * 60_000);
  const joinUrl = `https://academy.zoom.us/j/${sessionId}`;
  const { data: prior, error: priorError } = await db
    .from("sessions")
    .select("id,status")
    .or(`student_id.eq.${student.id},teacher_id.eq.${teacher.id}`);
  if (priorError) throw priorError;
  if (prior?.length) {
    const { error } = await db
      .from("sessions")
      .update({ status: "cancelled" })
      .in(
        "id",
        prior.map((item) => item.id),
      );
    if (error) throw error;
  }
  const { error: assignmentError } = await db.from("teacher_assignments").insert({
    id: assignmentId,
    student_id: student.id,
    teacher_id: teacher.id,
    track_id: track.id,
    assigned_by: "10000000-0000-4000-8000-000000000001",
    reason: "Session workspace browser test",
  });
  if (assignmentError) throw assignmentError;
  const { error: sessionError } = await db.from("sessions").insert({
    id: sessionId,
    assignment_id: assignmentId,
    student_id: student.id,
    teacher_id: teacher.id,
    scheduled_at: scheduledAt.toISOString(),
    ends_at: endsAt.toISOString(),
    duration_min: 30,
  });
  if (sessionError) throw sessionError;

  return {
    joinUrl,
    sessionId,
    studentName: student.full_name,
    async cleanup() {
      await db.from("sessions").delete().eq("id", sessionId);
      await db.from("teacher_assignments").delete().eq("id", assignmentId);
      for (const item of prior ?? []) {
        await db.from("sessions").update({ status: item.status }).eq("id", item.id);
      }
    },
  };
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
