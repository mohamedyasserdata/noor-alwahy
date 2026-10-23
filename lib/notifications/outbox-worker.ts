import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const claimedItemSchema = z.object({
  outbox_id: z.string().uuid(),
  notification_id: z.string().uuid(),
  attempts: z.coerce.number().int().min(1).max(5),
  recipient: z.email().nullable(),
  locale: z.enum(["ar", "en"]),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

const workerEnvSchema = z.object({
  RESEND_API_KEY: z.string().trim().min(1),
  EMAIL_FROM: z.string().trim().min(3),
  NEXT_PUBLIC_SITE_URL: z.url({ protocol: /^https?$/ }),
});

export async function processNotificationOutbox(limit = 25) {
  const env = workerEnvSchema.parse({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_outbox", { p_limit: limit });
  if (error) throw new Error("notification_outbox_claim_failed");
  const items = z.array(claimedItemSchema).parse(data);
  const results = await Promise.allSettled(items.map((item) => deliverItem(item, env)));
  return {
    claimed: items.length,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

async function deliverItem(
  item: z.infer<typeof claimedItemSchema>,
  env: z.infer<typeof workerEnvSchema>,
) {
  const admin = createAdminClient();
  try {
    if (!item.recipient) throw new Error("recipient_missing");
    const copy = emailCopy(item.locale, item.type, item.payload);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `notification-${item.notification_id}`,
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [item.recipient], ...copy }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`provider_${response.status}`);
    const { error } = await admin
      .from("notification_outbox")
      .update({ status: "sent", last_error: null })
      .eq("id", item.outbox_id)
      .eq("status", "processing");
    if (error) throw new Error("outbox_complete_failed");
  } catch (error) {
    const errorCode = safeError(error);
    const retryMinutes = Math.min(24 * 60, 2 ** item.attempts * 5);
    await admin
      .from("notification_outbox")
      .update({
        status: "failed",
        last_error: errorCode,
        next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
      })
      .eq("id", item.outbox_id)
      .eq("status", "processing");
    throw error;
  }
}

function emailCopy(locale: "ar" | "en", type: string, payload: Record<string, unknown>) {
  const escalated = type === "intervention_escalated";
  const priority = typeof payload.priority === "number" ? payload.priority : "—";
  const path = typeof payload.action_href === "string" ? payload.action_href : "";
  const href = new URL(path || "/", envSiteUrl()).toString();
  if (locale === "ar") {
    const subject = escalated ? "تم تصعيد حالة تحتاج تدخلك" : "حالة جديدة تحتاج تدخلك";
    return {
      subject,
      text: `${subject}\nالأولوية: ${priority}\nافتح مركز المتابعة: ${href}`,
      html: `<div dir="rtl"><h1>${subject}</h1><p>الأولوية: <strong>${priority}</strong></p><p><a href="${escapeHtml(href)}">فتح مركز المتابعة</a></p></div>`,
    };
  }
  const subject = escalated
    ? "An intervention case was escalated"
    : "A new case needs your attention";
  return {
    subject,
    text: `${subject}\nPriority: ${priority}\nOpen the control centre: ${href}`,
    html: `<div dir="ltr"><h1>${subject}</h1><p>Priority: <strong>${priority}</strong></p><p><a href="${escapeHtml(href)}">Open the control centre</a></p></div>`,
  };
}

function safeError(error: unknown) {
  const value = error instanceof Error ? error.message : "delivery_failed";
  return /^[a-z][a-z0-9_]{2,79}$/.test(value) ? value : "delivery_failed";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function envSiteUrl() {
  return workerEnvSchema.shape.NEXT_PUBLIC_SITE_URL.parse(process.env.NEXT_PUBLIC_SITE_URL);
}
