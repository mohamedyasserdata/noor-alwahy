import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import type { Database } from "../../types/database.types";

test("parent portal supports one, multiple, and empty families with isolated child details", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const fixture = await createFixture();
  const screenshotDir = join(process.cwd(), "output", "screenshots");
  await mkdir(screenshotDir, { recursive: true });

  try {
    await signIn(page, "ar", fixture.multiEmail, fixture.password);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/ar/parent/home");
    await expect(page.getByRole("heading", { level: 1, name: "بوابة ولي الأمر" })).toBeVisible();
    await expect(page.getByRole("link", { name: /عرض ملف الابن/ })).toHaveCount(2);
    await expect(page.getByRole("heading", { name: fixture.firstChildName })).toBeVisible();
    await expect(page.getByRole("heading", { name: fixture.secondChildName })).toBeVisible();
    await expect(page.getByRole("heading", { name: "الحصة القادمة" })).toBeVisible();
    await page.screenshot({ path: join(screenshotDir, "parent-home-ar-1440.png"), fullPage: true });

    await page.goto(`/ar/parent/children?student=${fixture.firstChildId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: fixture.firstChildName }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "تغيير الابن" })).toContainText(
      fixture.secondChildName,
    );
    const preservedContactHref = await page
      .locator('header a[href*="/parent/contact"]')
      .first()
      .getAttribute("href");
    expect(preservedContactHref).toContain(`student=${fixture.firstChildId}`);
    await expect(page.getByText("ملخص التعلم")).toBeVisible();
    await page.evaluate(() => document.scrollingElement?.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: join(screenshotDir, "parent-child-overview-ar-1440.png"),
      fullPage: false,
    });

    for (const tab of [
      { id: "progress", heading: "تقدم الحفظ" },
      { id: "attendance", heading: "الحضور والالتزام" },
      { id: "reports", heading: "لا توجد تقارير منشورة" },
      { id: "schedule", heading: "الحصص القادمة" },
    ]) {
      await page.goto(`/ar/parent/children?student=${fixture.firstChildId}&view=${tab.id}`);
      await expect(page.getByText(tab.heading, { exact: false }).first()).toBeVisible();
    }

    await page.goto(`/ar/parent/children?student=${fixture.privateChildId}`);
    await expect(
      page.getByRole("heading", { level: 1, name: fixture.firstChildName }),
    ).toBeVisible();
    await expect(page.getByText(fixture.privateChildName)).toHaveCount(0);

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/ar/parent/home");
      await expectNoHorizontalOverflow(page);
      await page.goto(`/en/parent/children?student=${fixture.firstChildId}&view=progress`);
      await expect(
        page.getByRole("heading", { level: 1, name: fixture.firstChildName }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/en/parent/home");
    const themeToggle = page.getByTestId("theme-toggle").filter({ visible: true });
    await themeToggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page);

    await signIn(page, "en", fixture.singleEmail, fixture.password);
    await expect(page.getByRole("link", { name: /View Child Profile/ })).toHaveCount(1);

    await signIn(page, "en", fixture.emptyEmail, fixture.password);
    await expect(page.getByText(/No children are linked to this account/)).toBeVisible();
    await expect(page.getByRole("link", { name: /View Child Profile/ })).toHaveCount(0);
  } finally {
    await cleanupFixture(fixture);
  }
});

async function createFixture() {
  const db = databaseClient();
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = "AcademyTest1!";
  const ids = {
    singleProfile: crypto.randomUUID(),
    multiProfile: crypto.randomUUID(),
    emptyProfile: crypto.randomUUID(),
    teacherProfile: crypto.randomUUID(),
    singleGuardian: crypto.randomUUID(),
    multiGuardian: crypto.randomUUID(),
    emptyGuardian: crypto.randomUUID(),
    teacher: crypto.randomUUID(),
    firstChild: crypto.randomUUID(),
    secondChild: crypto.randomUUID(),
    privateChild: crypto.randomUUID(),
    track: crypto.randomUUID(),
    firstAssignment: crypto.randomUUID(),
    secondAssignment: crypto.randomUUID(),
    pastSession: crypto.randomUUID(),
    nextSession: crypto.randomUUID(),
  };
  const singleEmail = `parent-one-${suffix}@noor.local`;
  const multiEmail = `parent-many-${suffix}@noor.local`;
  const emptyEmail = `parent-empty-${suffix}@noor.local`;
  const firstChildName = "أحمد";
  const secondChildName = "مريم";
  const privateChildName = "طفل غير مرتبط";

  for (const user of [
    { id: ids.singleProfile, email: singleEmail, role: "parent", name: "ولي أمر تجريبي" },
    { id: ids.multiProfile, email: multiEmail, role: "parent", name: "ولي أمر تجريبي" },
    { id: ids.emptyProfile, email: emptyEmail, role: "parent", name: "ولي أمر تجريبي" },
    {
      id: ids.teacherProfile,
      email: `parent-teacher-${suffix}@noor.local`,
      role: "teacher",
      name: "الشيخ أحمد المنصور",
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

  const now = new Date();
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await must(
    db.from("teachers").insert({
      id: ids.teacher,
      profile_id: ids.teacherProfile,
      gender: "male",
      status: "active",
      identity_verified_at: now.toISOString(),
      code_of_conduct_accepted_at: now.toISOString(),
    }),
  );
  await must(
    db.from("tracks").insert({
      id: ids.track,
      code: `parent-portal-${suffix}`,
      name_ar: "مسار اختبار ولي الأمر",
      name_en: "Parent portal test track",
    }),
  );
  await must(
    db.from("guardians").insert([
      { id: ids.singleGuardian, profile_id: ids.singleProfile },
      { id: ids.multiGuardian, profile_id: ids.multiProfile },
      { id: ids.emptyGuardian, profile_id: ids.emptyProfile },
    ]),
  );
  await must(
    db.from("students").insert([
      {
        id: ids.firstChild,
        full_name: firstChildName,
        gender: "male",
        timezone: "Africa/Cairo",
      },
      {
        id: ids.secondChild,
        full_name: secondChildName,
        gender: "male",
        timezone: "Africa/Cairo",
      },
      {
        id: ids.privateChild,
        full_name: privateChildName,
        gender: "male",
        timezone: "Africa/Cairo",
      },
    ]),
  );
  await must(
    db.from("student_guardians").insert([
      {
        student_id: ids.firstChild,
        guardian_id: ids.singleGuardian,
        relation: "parent",
        is_primary: false,
      },
      {
        student_id: ids.firstChild,
        guardian_id: ids.multiGuardian,
        relation: "parent",
        is_primary: true,
      },
      {
        student_id: ids.secondChild,
        guardian_id: ids.multiGuardian,
        relation: "parent",
        is_primary: false,
      },
    ]),
  );
  await must(db.from("teacher_tracks").insert({ teacher_id: ids.teacher, track_id: ids.track }));
  await must(
    db.from("teacher_assignments").insert([
      {
        id: ids.firstAssignment,
        student_id: ids.firstChild,
        teacher_id: ids.teacher,
        track_id: ids.track,
        assigned_by: "10000000-0000-4000-8000-000000000001",
        reason: "Parent portal test",
      },
      {
        id: ids.secondAssignment,
        student_id: ids.secondChild,
        teacher_id: ids.teacher,
        track_id: ids.track,
        assigned_by: "10000000-0000-4000-8000-000000000001",
        reason: "Parent portal test",
      },
    ]),
  );
  await must(
    db.from("sessions").insert([
      {
        id: ids.pastSession,
        assignment_id: ids.firstAssignment,
        student_id: ids.firstChild,
        teacher_id: ids.teacher,
        scheduled_at: past.toISOString(),
        ends_at: new Date(past.getTime() + 30 * 60 * 1000).toISOString(),
        duration_min: 30,
        status: "held",
      },
      {
        id: ids.nextSession,
        assignment_id: ids.firstAssignment,
        student_id: ids.firstChild,
        teacher_id: ids.teacher,
        scheduled_at: future.toISOString(),
        ends_at: new Date(future.getTime() + 30 * 60 * 1000).toISOString(),
        duration_min: 30,
        status: "scheduled",
      },
    ]),
  );
  await must(
    db.from("attendance").insert({
      session_id: ids.pastSession,
      status: "present",
      recorded_by: ids.teacherProfile,
      minutes: 30,
    }),
  );

  return {
    db,
    ids,
    password,
    singleEmail,
    multiEmail,
    emptyEmail,
    firstChildId: ids.firstChild,
    firstChildName,
    secondChildName,
    privateChildId: ids.privateChild,
    privateChildName,
  };
}

async function cleanupFixture(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const { db, ids } = fixture;
  await db.from("attendance").delete().eq("session_id", ids.pastSession);
  await db.from("sessions").delete().in("id", [ids.pastSession, ids.nextSession]);
  await db
    .from("teacher_assignments")
    .delete()
    .in("id", [ids.firstAssignment, ids.secondAssignment]);
  await db
    .from("student_guardians")
    .delete()
    .in("guardian_id", [ids.singleGuardian, ids.multiGuardian]);
  await db.from("teacher_tracks").delete().eq("teacher_id", ids.teacher);
  await db.from("students").delete().in("id", [ids.firstChild, ids.secondChild, ids.privateChild]);
  await db
    .from("guardians")
    .delete()
    .in("id", [ids.singleGuardian, ids.multiGuardian, ids.emptyGuardian]);
  await db.from("teachers").delete().eq("id", ids.teacher);
  await db.from("tracks").delete().eq("id", ids.track);
  for (const id of [ids.singleProfile, ids.multiProfile, ids.emptyProfile, ids.teacherProfile]) {
    await db.auth.admin.deleteUser(id);
  }
}

async function signIn(page: Page, locale: "ar" | "en", email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(`/${locale}/auth/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/parent/home(?:\\?.*)?$`), {
    timeout: 20_000,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

async function must(result: PromiseLike<{ error: unknown }>) {
  const { error } = await result;
  if (error) throw error;
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
