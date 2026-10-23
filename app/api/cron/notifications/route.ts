import { timingSafeEqual } from "node:crypto";

import { processNotificationOutbox } from "@/lib/notifications/outbox-worker";
import { reportJobFailure } from "@/lib/monitoring/job-alert";

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await processNotificationOutbox(25);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await reportJobFailure("notification_outbox", "notification_worker_failed");
    return Response.json({ error: "notification_worker_failed" }, { status: 503 });
  }
}

function authorized(header: string | null, secret: string | undefined) {
  if (!header?.startsWith("Bearer ") || !secret) return false;
  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
