import { randomUUID } from "node:crypto";

import {
  applicationHash,
  requesterIp,
  verifyApplicationCaptcha,
} from "@/lib/applications/security";
import { legalDocumentVersion } from "@/lib/legal/documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { teacherApplicationSchema } from "@/lib/validators/teacher-applications";

const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
const MAX_CV_BYTES = 5 * 1024 * 1024;
const allowedCvTypes = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    return Response.json({ error: "invalid_request" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "cv_too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const cv = form.get("cv");
  const parsed = teacherApplicationSchema.safeParse({
    locale: form.get("locale"),
    full_name: form.get("full_name"),
    email: form.get("email"),
    phone: form.get("phone"),
    gender: form.get("gender"),
    specialization: form.get("specialization"),
    qualifications: form.get("qualifications"),
    experience_years: form.get("experience_years"),
    teaching_languages: form.getAll("teaching_languages"),
    availability: form.get("availability"),
    consent: form.get("consent"),
    captcha_token: form.get("captcha_token"),
  });
  if (!parsed.success) return Response.json({ error: "invalid_fields" }, { status: 400 });

  if (cv !== null && (!(cv instanceof File) || (cv.size > 0 && !allowedCvTypes.has(cv.type)))) {
    return Response.json({ error: "cv_type" }, { status: 400 });
  }
  if (cv instanceof File && cv.size > MAX_CV_BYTES) {
    return Response.json({ error: "cv_too_large" }, { status: 413 });
  }

  const ip = requesterIp(request);
  if (!(await verifyApplicationCaptcha(parsed.data.captcha_token, ip))) {
    return Response.json({ error: "captcha_failed" }, { status: 400 });
  }

  const admin = createAdminClient();
  let cvPath = "";
  let cvName = "";
  if (cv instanceof File && cv.size > 0) {
    const extension = allowedCvTypes.get(cv.type);
    if (!extension) return Response.json({ error: "cv_type" }, { status: 400 });
    cvPath = `uploads/${randomUUID()}.${extension}`;
    cvName = safeFileName(cv.name, extension);
    const { error: uploadError } = await admin.storage
      .from("teacher-applications")
      .upload(cvPath, cv, { cacheControl: "0", contentType: cv.type, upsert: false });
    if (uploadError) return Response.json({ error: "cv_upload_failed" }, { status: 503 });
  }

  const contactHash = applicationHash(`teacher:${parsed.data.email}`);
  const { data, error } = await admin.rpc("submit_teacher_application", {
    p_payload: {
      ...parsed.data,
      captcha_token: undefined,
      consent: undefined,
      consent_version: legalDocumentVersion,
      cv_name: cvName,
      cv_path: cvPath,
      source: "teacher_join_page",
    },
    p_ip_hash: applicationHash(`ip:${ip}`),
    p_contact_hash: contactHash,
  });

  if (error) {
    if (cvPath) await admin.storage.from("teacher-applications").remove([cvPath]);
    const code = error.message.includes("teacher_application_exists")
      ? "already_submitted"
      : error.message.includes("teacher_application_rate_limited")
        ? "rate_limited"
        : "submission_failed";
    const status = code === "already_submitted" ? 409 : code === "rate_limited" ? 429 : 400;
    return Response.json({ error: code }, { status });
  }

  return Response.json(
    { application_no: data },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

function safeFileName(name: string, extension: string) {
  const stem = name
    .replace(/\.[^.]+$/u, "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
    .trim()
    .slice(0, 150);
  return `${stem || "cv"}.${extension}`;
}
