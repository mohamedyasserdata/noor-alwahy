import "server-only";

export async function reportJobFailure(job: string, errorCode: string) {
  const url = process.env.MONITORING_ALERT_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "noor-alwahy",
        environment: process.env.DEPLOYMENT_ENVIRONMENT ?? "unknown",
        job,
        errorCode,
        occurredAt: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    console.error(JSON.stringify({ level: "error", event: "monitoring_alert_failed", job }));
  }
}
