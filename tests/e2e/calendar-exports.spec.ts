import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("P3-T08 exports a safe iCal file and rotates a revocable private feed", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await signInAs(page, "en", "student");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/en/student/schedule");
    await expect(page.getByRole("heading", { name: "Calendar export" })).toBeVisible();
    await expect(page.getByText("Africa/Cairo", { exact: true }).first()).toBeVisible();

    const download = await page.request.get("/api/calendar/download");
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("text/calendar");
    expect(download.headers()["content-disposition"]).toContain("attachment");
    const authenticatedCalendar = await download.text();
    expect(authenticatedCalendar).toContain(`UID:${fixture.sessionId}@noor-alwahy`);
    expect(authenticatedCalendar).toContain("X-WR-TIMEZONE:Africa/Cairo");
    expect(authenticatedCalendar).not.toMatch(
      /calendar-zoom-secret|meeting-secret|passcode-secret/i,
    );

    const pdfDownload = await page.request.get("/api/calendar/pdf");
    expect(pdfDownload.status()).toBe(200);
    expect(pdfDownload.headers()["content-type"]).toContain("application/pdf");
    const pdf = await pdfDownload.body();
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const pdfDir = resolve("output/pdf");
    await mkdir(pdfDir, { recursive: true });
    await writeFile(resolve(pdfDir, "schedule-e2e.pdf"), pdf);

    await page.getByRole("button", { name: "Create private link" }).click();
    await expect(page.getByText(/A new private link was created/)).toBeVisible();
    const input = page.locator("#calendar-subscription-url");
    const firstUrl = await input.inputValue();
    expect(firstUrl).toMatch(/\/api\/calendar\/[A-Za-z0-9_-]{43}$/);

    const firstFeed = await page.request.get(firstUrl);
    expect(firstFeed.status()).toBe(200);
    expect(firstFeed.headers()["cache-control"]).toContain("no-store");
    expect(await firstFeed.text()).toContain(`UID:${fixture.sessionId}@noor-alwahy`);

    await page.getByRole("button", { name: "Create private link" }).click();
    await expect(input).not.toHaveValue(firstUrl);
    const secondUrl = await input.inputValue();
    expect(secondUrl).not.toBe(firstUrl);
    expect((await page.request.get(firstUrl)).status()).toBe(404);
    expect((await page.request.get(secondUrl)).status()).toBe(200);

    const rawToken = new URL(secondUrl).pathname.split("/").at(-1);
    const db = serviceClient();
    const { data: storedToken, error: tokenError } = await db
      .from("calendar_feed_tokens")
      .select("token_hash")
      .eq("user_id", "10000000-0000-4000-8000-000000000003")
      .single();
    if (tokenError) throw tokenError;
    expect(storedToken.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(storedToken.token_hash).not.toBe(rawToken);

    await page.getByRole("button", { name: "Revoke link" }).click();
    await expect(page.getByText("The private calendar link was revoked.")).toBeVisible();
    expect((await page.request.get(secondUrl)).status()).toBe(404);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(consoleErrors).toEqual([]);
  } finally {
    await cleanupFixture(fixture);
  }
});

type FixtureClient = SupabaseClient<Database>;

async function createFixture() {
  const db = serviceClient();
  const teacher = await findOrCreateTeacher(db);
  const student = await findOrCreateStudent(db);
  const teacherId = teacher.id;
  const studentId = student.id;
  const trackId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  const { error: trackError } = await db.from("tracks").insert({
    id: trackId,
    code: `calendar-${trackId.slice(0, 8)}`,
    name_ar: "تصدير التقويم",
    name_en: "Calendar export",
  });
  if (trackError) throw trackError;

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
    reason: "Calendar export test",
  });
  if (assignmentError) throw assignmentError;

  const scheduledAt = await findAvailableSlot(db, teacherId, studentId);
  const { error: sessionError } = await db.from("sessions").insert({
    id: sessionId,
    assignment_id: assignmentId,
    student_id: studentId,
    teacher_id: teacherId,
    scheduled_at: scheduledAt.toISO(),
    ends_at: scheduledAt.plus({ minutes: 20 }).toISO(),
    duration_min: 20,
    zoom_override_url: "https://academy.zoom.us/j/calendar-zoom-secret",
    zoom_meeting_id: "meeting-secret",
    zoom_passcode: "passcode-secret",
  });
  if (sessionError) throw sessionError;

  return {
    assignmentId,
    sessionId,
    studentCreated: student.created,
    studentId,
    teacherCreated: teacher.created,
    teacherId,
    trackId,
  };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const db = serviceClient();
  const operations = [
    db.from("calendar_feed_tokens").delete().eq("user_id", "10000000-0000-4000-8000-000000000003"),
    db.from("sessions").delete().eq("id", fixture.sessionId),
    db.from("teacher_assignments").delete().eq("id", fixture.assignmentId),
    db
      .from("teacher_tracks")
      .delete()
      .eq("teacher_id", fixture.teacherId)
      .eq("track_id", fixture.trackId),
    db.from("tracks").delete().eq("id", fixture.trackId),
  ];
  for (const operation of operations) {
    const { error } = await operation;
    if (error) throw error;
  }
  if (fixture.teacherCreated) {
    const { error } = await db.from("teachers").delete().eq("id", fixture.teacherId);
    if (error) throw error;
  }
  if (fixture.studentCreated) {
    const { error } = await db.from("students").delete().eq("id", fixture.studentId);
    if (error) throw error;
  }
}

async function findAvailableSlot(db: FixtureClient, teacherId: string, studentId: string) {
  const windowStart = DateTime.utc().plus({ days: 23 }).startOf("day").plus({ hours: 1 });
  const windowEnd = DateTime.utc().plus({ days: 27 }).endOf("day");
  const { data, error } = await db
    .from("sessions")
    .select("scheduled_at,ends_at")
    .or(`teacher_id.eq.${teacherId},student_id.eq.${studentId}`)
    .gte("scheduled_at", windowStart.toISO())
    .lt("scheduled_at", windowEnd.toISO());
  if (error) throw error;

  for (
    let candidate = windowStart;
    candidate < windowEnd;
    candidate = candidate.plus({ minutes: 30 })
  ) {
    const candidateEnd = candidate.plus({ minutes: 20 });
    const overlaps = data.some((session) => {
      const start = DateTime.fromISO(session.scheduled_at, { setZone: true });
      const end = DateTime.fromISO(session.ends_at, { setZone: true });
      return candidate < end && candidateEnd > start;
    });
    if (!overlaps) return candidate;
  }

  throw new Error("No available calendar export test slot.");
}

async function findOrCreateTeacher(db: FixtureClient) {
  const profileId = "10000000-0000-4000-8000-000000000002";
  const { data } = await db.from("teachers").select("id").eq("profile_id", profileId).maybeSingle();
  if (data) return { created: false, id: data.id };
  const id = crypto.randomUUID();
  const now = DateTime.utc().toISO();
  const { error } = await db.from("teachers").insert({
    id,
    profile_id: profileId,
    gender: "male",
    status: "active",
    identity_verified_at: now,
    code_of_conduct_accepted_at: now,
  });
  if (error) throw error;
  return { created: true, id };
}

async function findOrCreateStudent(db: FixtureClient) {
  const profileId = "10000000-0000-4000-8000-000000000003";
  const { data } = await db.from("students").select("id").eq("profile_id", profileId).maybeSingle();
  if (data) return { created: false, id: data.id };
  const id = crypto.randomUUID();
  const { error } = await db.from("students").insert({
    id,
    profile_id: profileId,
    full_name: "Calendar Student",
    gender: "male",
    timezone: "Africa/Cairo",
  });
  if (error) throw error;
  return { created: true, id };
}

function serviceClient() {
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
