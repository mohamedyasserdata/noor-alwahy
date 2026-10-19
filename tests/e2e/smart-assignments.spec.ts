import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { signInAs } from "./helpers/auth";

test("US-062 assigns, changes and preserves teacher assignment history", async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await createFixture();

  await signInAs(page, "en", "admin");
  await page.goto(
    `/en/admin/assignments?studentId=${fixture.studentId}&trackId=${fixture.trackId}`,
  );

  const firstCandidate = page
    .locator("article")
    .filter({ hasText: "Assignment Teacher One" })
    .filter({ has: page.getByRole("button", { name: "Assign teacher" }) });
  await expect(firstCandidate).toContainText("0/2");
  await firstCandidate.locator('input[name="reason"]').fill("Initial matching assignment");
  await firstCandidate.getByRole("button", { name: "Assign teacher" }).click();
  await expect(page).toHaveURL(/assignmentStatus=assign$/);
  await expect(page.getByText("Teacher assigned.")).toBeVisible();

  await page.goto(
    `/en/admin/assignments?studentId=${fixture.studentId}&trackId=${fixture.trackId}`,
  );
  await expect(page.getByRole("heading", { name: "Change the current teacher" })).toBeVisible();
  await expect(page.getByText("Assignment Teacher One").first()).toBeVisible();
  const secondCandidate = page
    .locator("article")
    .filter({ hasText: "Assignment Teacher Two" })
    .filter({ has: page.getByRole("button", { name: "Change teacher" }) });
  await secondCandidate.locator('input[name="reason"]').fill("Schedule compatibility improved");
  await secondCandidate.getByRole("button", { name: "Change teacher" }).click();
  await expect(page).toHaveURL(/assignmentStatus=change$/);

  await page.goto(
    `/en/admin/assignments?studentId=${fixture.studentId}&trackId=${fixture.trackId}`,
  );
  await expect(page.getByText("Assignment Teacher Two").first()).toBeVisible();
  await expect(page.getByText("Assignment Teacher One").first()).toBeVisible();
  const current = page.locator("aside");
  await current.locator('input[name="reason"]').first().fill("Temporary learner pause");
  await current.getByRole("button", { name: "Pause" }).click();
  await expect(page).toHaveURL(/assignmentStatus=pause$/);
  await expect(page.getByText("Assignment paused.")).toBeVisible();
});

async function createFixture() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const suffix = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const firstProfileId = crypto.randomUUID();
  const secondProfileId = crypto.randomUUID();

  for (const [id, label] of [
    [firstProfileId, "One"],
    [secondProfileId, "Two"],
  ] as const) {
    const { error: userError } = await db.auth.admin.createUser({
      id,
      email: `assignment-${label.toLowerCase()}-${suffix}@noor.local`,
      password: "AcademyTest1!",
      email_confirm: true,
      app_metadata: { role: "teacher" },
      user_metadata: { full_name: `Assignment Teacher ${label}` },
    });
    if (userError) throw userError;
  }

  const { error } = await db.from("tracks").insert({
    id: trackId,
    code: `assign-${suffix.slice(0, 8)}`,
    name_ar: "مسار التكليف",
    name_en: "Assignment Track",
  });
  if (error) throw error;

  const { data: teachers, error: teacherError } = await db
    .from("teachers")
    .insert([
      {
        profile_id: firstProfileId,
        gender: "male",
        max_students: 2,
        status: "active",
        identity_verified_at: new Date().toISOString(),
        code_of_conduct_accepted_at: new Date().toISOString(),
      },
      {
        profile_id: secondProfileId,
        gender: "male",
        max_students: 3,
        status: "active",
        identity_verified_at: new Date().toISOString(),
        code_of_conduct_accepted_at: new Date().toISOString(),
      },
    ])
    .select("id,profile_id");
  if (teacherError) throw teacherError;
  const first = teachers.find((teacher) => teacher.profile_id === firstProfileId);
  const second = teachers.find((teacher) => teacher.profile_id === secondProfileId);
  if (!first || !second) throw new Error("Assignment teacher fixtures were not created.");

  const { error: trackError } = await db.from("teacher_tracks").insert([
    { teacher_id: first.id, track_id: trackId },
    { teacher_id: second.id, track_id: trackId },
  ]);
  if (trackError) throw trackError;
  const { error: availabilityError } = await db.from("teacher_availability").insert({
    teacher_id: first.id,
    weekday: 1,
    start_time: "09:00",
    end_time: "10:00",
    status: "approved",
  });
  if (availabilityError) throw availabilityError;
  const { error: studentError } = await db.from("students").insert({
    id: studentId,
    full_name: "Assignment Student",
    gender: "male",
    timezone: "Africa/Cairo",
  });
  if (studentError) throw studentError;
  return { studentId, trackId };
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
