import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

test("P5 report flows from teacher approval through admin publication to isolated family dashboards", async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(20_000);
  const fixture = await createFixture();
  const db = databaseClient();

  await signIn(page, fixture.teacherEmail, fixture.password, "/en/teacher/today");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en/teacher/reports");
  await expect(page.getByRole("heading", { name: "Clear reports, trusted numbers" })).toBeVisible();
  await page.getByText("Create student reports in a batch", { exact: true }).click();
  await page.getByRole("checkbox", { name: fixture.studentName }).check();
  await page.getByRole("checkbox", { name: fixture.unrelatedStudentName }).check();
  await page.locator("#batch-period-start").fill("2026-09-01");
  await page.locator("#batch-period-end").fill("2026-09-07");
  await page.getByRole("button", { name: "Create drafts" }).click();
  await expect(page).toHaveURL(/reportStatus=batch_created/);
  const { count: batchCount, error: batchError } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .in("student_id", [fixture.studentId, fixture.unrelatedStudentId])
    .eq("period_start", "2026-09-01");
  if (batchError) throw batchError;
  expect(batchCount).toBe(2);

  await page.locator('select[name="studentId"]').first().selectOption(fixture.studentId);
  await page.locator("#periodStart-new").fill("2026-10-05");
  await page.locator("#periodEnd-new").fill("2026-10-11");
  await page.getByLabel("Progress summary").first().fill("Steady progress across the week");
  await page.getByLabel("Strengths").first().fill("Careful recitation and commitment");
  await page.getByLabel("Areas to improve").first().fill("Keep a daily review rhythm");
  await page.getByLabel("Next-period plan").first().fill("Memorise two pages and review four");
  await page
    .getByLabel("Recommendation for student and guardian")
    .first()
    .fill("Continue the same calm routine");
  await page.getByRole("button", { name: "Save draft" }).first().click();
  await expect(page).toHaveURL(/reportStatus=saved/);
  await expect(page.getByText("Draft saved and metrics refreshed.")).toBeVisible();
  const reportCard = page
    .locator("article.overflow-hidden")
    .filter({ hasText: fixture.studentName })
    .filter({ hasText: "2026-10-05" });
  await expect(reportCard.getByText("Draft", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const pdfLink = reportCard.getByRole("link", { name: "Download PDF" });
  const pdfResponse = await page
    .context()
    .request.get((await pdfLink.getAttribute("href")) as string);
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
  const pdf = await pdfResponse.body();
  expect(pdf.byteLength).toBeGreaterThan(10_000);
  const pdfOutput = join(process.cwd(), "output", "pdf");
  await mkdir(pdfOutput, { recursive: true });
  await writeFile(join(pdfOutput, "report-phase5.pdf"), pdf);

  await reportCard.getByRole("button", { name: "Send to administration" }).click();
  await expect(page).toHaveURL(/reportStatus=approved/);

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/reports");
  const adminCard = page
    .locator("article")
    .filter({ hasText: fixture.studentName })
    .filter({ hasText: "2026-10-05" });
  await expect(adminCard).toBeVisible();
  await expect(adminCard.getByText("Pending admin review", { exact: true })).toBeVisible();
  await adminCard.getByLabel("Revision reason").fill("Clarify the next-period plan");
  await adminCard.getByText("Review revision request", { exact: true }).click();
  await adminCard.getByRole("button", { name: "Return to teacher" }).click();
  await expect(page).toHaveURL(/reportStatus=updated/);

  await signIn(page, fixture.teacherEmail, fixture.password, "/en/teacher/today");
  await page.goto("/en/teacher/reports");
  const returnedCard = page
    .locator("article.overflow-hidden")
    .filter({ hasText: fixture.studentName })
    .filter({ hasText: "2026-10-05" });
  await expect(returnedCard.getByText("Revision requested", { exact: true })).toBeVisible();
  await expect(returnedCard.getByText("Clarify the next-period plan")).toBeVisible();
  await returnedCard
    .getByLabel("Next-period plan")
    .fill("Memorise two pages and review six with the teacher");
  await returnedCard.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/reportStatus=saved/);
  await returnedCard.getByRole("button", { name: "Send to administration" }).click();
  await expect(page).toHaveURL(/reportStatus=approved/);

  await signInAs(page, "en", "admin");
  await page.goto("/en/admin/reports");
  const finalAdminCard = page
    .locator("article")
    .filter({ hasText: fixture.studentName })
    .filter({ hasText: "2026-10-05" });
  await finalAdminCard
    .getByLabel("Performance summary")
    .fill("Steady progress across the week — reviewed by administration");
  await finalAdminCard.getByText("Review approval and publication", { exact: true }).click();
  await finalAdminCard.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page).toHaveURL(/reportStatus=updated/);
  await expect(finalAdminCard.getByText("Approved and published", { exact: true })).toBeVisible();
  await expect(finalAdminCard.getByText("Published version 1", { exact: true })).toBeVisible();

  const { data: publishedReport, error: publishedError } = await db
    .from("reports")
    .select("id,published_version")
    .eq("student_id", fixture.studentId)
    .eq("period_start", "2026-10-05")
    .single();
  if (publishedError) throw publishedError;
  expect(publishedReport.published_version).toBe(1);
  const { count: versionCount, error: versionError } = await db
    .from("report_versions")
    .select("id", { count: "exact", head: true })
    .eq("report_id", publishedReport.id);
  if (versionError) throw versionError;
  expect(versionCount).toBe(1);

  await signIn(page, fixture.parentEmail, fixture.password, "/en/parent/home");
  await page.goto(`/en/parent/children?student=${fixture.unrelatedStudentId}&view=reports`);
  await expect(page.getByRole("heading", { name: fixture.studentName })).toBeVisible();
  await expect(page.getByText(fixture.unrelatedStudentName)).toHaveCount(0);
  await page.getByRole("button", { name: "Open notifications" }).click();
  await expect(page.getByText("Student report approved")).toBeVisible();
  const parentPdf = page.getByRole("link", { name: "View or Download PDF" });
  await expect(parentPdf).toBeVisible();
  const arabicPdfResponse = await page
    .context()
    .request.get((await parentPdf.getAttribute("href"))!.replace("locale=en", "locale=ar"));
  expect(arabicPdfResponse.status()).toBe(200);
  await writeFile(join(pdfOutput, "report-phase5-ar.pdf"), await arabicPdfResponse.body());

  await signIn(page, fixture.studentEmail, fixture.password, "/en/student/home");
  await page.goto("/en/student/reports");
  await expect(page.getByRole("heading", { name: "Published reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View or download PDF" })).toBeVisible();
});

async function createFixture() {
  const db = databaseClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = "AcademyTest1!";
  const ids = {
    teacherProfile: crypto.randomUUID(),
    studentProfile: crypto.randomUUID(),
    parentProfile: crypto.randomUUID(),
    unrelatedProfile: crypto.randomUUID(),
    teacher: crypto.randomUUID(),
    student: crypto.randomUUID(),
    parent: crypto.randomUUID(),
    unrelatedStudent: crypto.randomUUID(),
    track: crypto.randomUUID(),
  };
  const teacherEmail = `p5-teacher-${suffix}@noor.local`;
  const studentEmail = `p5-student-${suffix}@noor.local`;
  const parentEmail = `p5-parent-${suffix}@noor.local`;
  const studentName = `P5 Student ${suffix}`;
  const unrelatedStudentName = `Private Student ${suffix}`;
  for (const user of [
    { id: ids.teacherProfile, email: teacherEmail, role: "teacher", name: `P5 Teacher ${suffix}` },
    { id: ids.studentProfile, email: studentEmail, role: "student", name: studentName },
    { id: ids.parentProfile, email: parentEmail, role: "parent", name: `P5 Parent ${suffix}` },
    {
      id: ids.unrelatedProfile,
      email: `p5-private-${suffix}@noor.local`,
      role: "student",
      name: unrelatedStudentName,
    },
  ]) {
    const { error } = await db.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password,
      email_confirm: true,
      app_metadata: { role: user.role },
      user_metadata: { full_name: user.name, role: user.role },
    });
    if (error) throw error;
  }
  const timestamp = new Date().toISOString();
  for (const write of [
    db.from("teachers").insert({
      id: ids.teacher,
      profile_id: ids.teacherProfile,
      gender: "male",
      status: "active",
      identity_verified_at: timestamp,
      code_of_conduct_accepted_at: timestamp,
    }),
    db.from("students").insert({
      id: ids.student,
      profile_id: ids.studentProfile,
      full_name: studentName,
      gender: "male",
      timezone: "Africa/Cairo",
    }),
    db.from("students").insert({
      id: ids.unrelatedStudent,
      profile_id: ids.unrelatedProfile,
      full_name: unrelatedStudentName,
      gender: "male",
      timezone: "Africa/Cairo",
    }),
    db.from("guardians").insert({ id: ids.parent, profile_id: ids.parentProfile }),
    db.from("tracks").insert({
      id: ids.track,
      code: `p5-${suffix}`,
      name_ar: "اختبار المرحلة الخامسة",
      name_en: "Phase five test",
    }),
  ]) {
    const { error } = await write;
    if (error) throw error;
  }
  for (const write of [
    db.from("teacher_tracks").insert({ teacher_id: ids.teacher, track_id: ids.track }),
    db.from("student_guardians").insert({
      student_id: ids.student,
      guardian_id: ids.parent,
      relation: "parent",
      is_primary: true,
    }),
    db.from("teacher_assignments").insert({
      student_id: ids.student,
      teacher_id: ids.teacher,
      track_id: ids.track,
      assigned_by: "10000000-0000-4000-8000-000000000001",
      reason: "Phase five browser gate",
    }),
    db.from("teacher_assignments").insert({
      student_id: ids.unrelatedStudent,
      teacher_id: ids.teacher,
      track_id: ids.track,
      assigned_by: "10000000-0000-4000-8000-000000000001",
      reason: "Phase five batch isolation gate",
    }),
  ]) {
    const { error } = await write;
    if (error) throw error;
  }
  return {
    password,
    teacherEmail,
    studentEmail,
    parentEmail,
    studentId: ids.student,
    studentName,
    unrelatedStudentId: ids.unrelatedStudent,
    unrelatedStudentName,
  };
}

async function signIn(page: Page, email: string, password: string, home: string) {
  await page.context().clearCookies();
  await page.goto("/en/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`${home}(?:\\?.*)?$`));
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
