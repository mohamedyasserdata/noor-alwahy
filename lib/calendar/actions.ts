"use server";

import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { failure, success, type Result } from "../result";

type CalendarTokenError = "calendar_auth_required" | "request_failed" | "validation_error";

const emptyInputSchema = z.object({}).strict();

export async function rotateCalendarFeedTokenAction(
  input: unknown,
): Promise<Result<{ path: string }, CalendarTokenError>> {
  if (!emptyInputSchema.safeParse(input).success) {
    return failure("validation_error", "errors.validation");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure("calendar_auth_required", "calendar.errors.auth");

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken, "utf8").digest("hex");
  const { error } = await supabase.rpc("rotate_calendar_feed_token", {
    p_token_hash: tokenHash,
  });
  if (error) return failure("request_failed", "calendar.errors.request");

  return success({ path: `/api/calendar/${rawToken}` });
}

export async function revokeCalendarFeedTokenAction(
  input: unknown,
): Promise<Result<null, CalendarTokenError>> {
  if (!emptyInputSchema.safeParse(input).success) {
    return failure("validation_error", "errors.validation");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure("calendar_auth_required", "calendar.errors.auth");

  const { error } = await supabase.rpc("revoke_calendar_feed_token");
  if (error) return failure("request_failed", "calendar.errors.request");
  return success(null);
}
