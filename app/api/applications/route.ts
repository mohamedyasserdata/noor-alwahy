import { createAdminClient } from "@/lib/supabase/admin";
import {
  applicationHash,
  lookupIdentifier,
  requesterIp,
  verifyApplicationCaptcha,
} from "@/lib/applications/security";
import { publicApplicationSchema } from "@/lib/validators/applications";
import { legalDocumentVersion } from "@/lib/legal/documents";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json"))
    return Response.json({ error: "invalid_request" }, { status: 415 });
  const raw = await request.text();
  if (raw.length > 32_768) return Response.json({ error: "invalid_request" }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const parsed = publicApplicationSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "invalid_fields" }, { status: 400 });
  const ip = requesterIp(request);
  if (!(await verifyApplicationCaptcha(parsed.data.captcha_token, ip)))
    return Response.json({ error: "captcha_failed" }, { status: 400 });

  const identifier = lookupIdentifier(parsed.data.contact_email, parsed.data.contact_phone);
  const contact = parsed.data.contact_email || parsed.data.contact_phone.replace(/\D/g, "");
  const payload = {
    ...parsed.data,
    captcha_token: undefined,
    consent: undefined,
    consent_version: legalDocumentVersion,
  };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_application", {
    p_payload: payload,
    p_lookup_hash: applicationHash(identifier.value),
    p_ip_hash: applicationHash(`ip:${ip}`),
    p_contact_hash: applicationHash(`contact:${contact}`),
  });
  if (error) {
    const code = error.message.includes("application_rate_limited")
      ? "rate_limited"
      : error.message.includes("unavailable")
        ? "selection_unavailable"
        : "submission_failed";
    return Response.json({ error: code }, { status: code === "rate_limited" ? 429 : 400 });
  }
  return Response.json(
    { order_no: data, identifier_hint: identifier.hint },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
