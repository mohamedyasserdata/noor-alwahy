import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../../types/database.types";
import { signInAs } from "./helpers/auth";

const studentProfileId = "10000000-0000-4000-8000-000000000003";

test("US-150/151 notification bell refreshes through Realtime and saves preferences", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const db = createClient<Database>(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  await cleanup(db);

  try {
    await signInAs(page, "en", "student");
    const bell = page.getByRole("button", { name: "Open notifications" });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByText("You are all caught up.")).toBeVisible();
    await expect(page.locator('[data-realtime-status="subscribed"]')).toBeVisible({
      timeout: 15_000,
    });

    const notificationId = crypto.randomUUID();
    const { error: insertError } = await db.from("notifications").insert({
      id: notificationId,
      user_id: studentProfileId,
      type: "schedule_changed",
      payload: { session_id: crypto.randomUUID() },
    });
    if (insertError) throw insertError;

    const notification = page.getByRole("button", { name: /A session time has changed/ });
    await expect(notification).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("1 unread notification")).toBeVisible();
    await notification.click();
    await expect(page.getByText("No unread notifications")).toBeVisible();

    await page.getByRole("button", { name: "Notification preferences" }).click();
    const schedulePreference = page.getByRole("checkbox", { name: "Schedule changes" });
    await expect(schedulePreference).toBeChecked();
    await schedulePreference.uncheck();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved.")).toBeVisible();

    const { data: preference, error: preferenceError } = await db
      .from("notification_prefs")
      .select("prefs")
      .eq("user_id", studentProfileId)
      .single();
    if (preferenceError) throw preferenceError;
    expect(preference.prefs).toMatchObject({ schedule_changed: false });

    await page.setViewportSize({ width: 360, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  } finally {
    await cleanup(db);
  }
});

async function cleanup(db: ReturnType<typeof createClient<Database>>) {
  const { error: notificationError } = await db
    .from("notifications")
    .delete()
    .eq("user_id", studentProfileId);
  if (notificationError) throw notificationError;
  const { error: preferenceError } = await db
    .from("notification_prefs")
    .delete()
    .eq("user_id", studentProfileId);
  if (preferenceError) throw preferenceError;
}

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
