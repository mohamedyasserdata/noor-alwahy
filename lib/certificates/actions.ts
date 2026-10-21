"use server";

import { randomUUID } from "node:crypto";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  batchCertificateSchema,
  certificateTemplateSchema,
  certificateTemplateUpdateSchema,
  certificateVersionSchema,
  issueCertificateSchema,
  processCertificateBatchSchema,
} from "@/lib/validators/certificates";

function locale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}
function go(value: AppLocale, key: string, code: string): never {
  redirect(`/${value}/admin/certificates?${new URLSearchParams({ [key]: code })}` as Route);
}
function refresh(value: AppLocale) {
  revalidatePath(`/${value}/admin/certificates`);
  revalidatePath(`/${value}/student/certificates`);
}

export async function createCertificateTemplateAction(localeValue: string, formData: FormData) {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const supabase = await createClient();
  const uploaded: string[] = [];
  try {
    const [logoPath, sealPath, signaturePath] = await Promise.all([
      uploadAsset(supabase, formData.get("logo"), "logos", uploaded),
      uploadAsset(supabase, formData.get("seal"), "seals", uploaded),
      uploadAsset(supabase, formData.get("signature"), "signatures", uploaded),
    ]);
    const parsed = certificateTemplateSchema.safeParse({
      kind: formData.get("kind"),
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn") ?? "",
      titleAr: formData.get("titleAr"),
      titleEn: formData.get("titleEn") ?? "",
      bodyAr: formData.get("bodyAr"),
      bodyEn: formData.get("bodyEn") ?? "",
      logoPath,
      sealPath,
      signerName: formData.get("signerName") ?? "",
      signerTitle: formData.get("signerTitle") ?? "",
      signaturePath,
      style: formData.get("style"),
      primary: formData.get("primary"),
      accent: formData.get("accent"),
    });
    if (!parsed.success) throw new Error("invalid_template");
    const signatures = parsed.data.signerName
      ? [
          {
            name: parsed.data.signerName,
            title: parsed.data.signerTitle,
            ...(parsed.data.signaturePath ? { image_path: parsed.data.signaturePath } : {}),
          },
        ]
      : [];
    const { error } = await supabase.rpc("create_certificate_template", {
      p_kind: parsed.data.kind,
      p_name_ar: parsed.data.nameAr,
      p_name_en: parsed.data.nameEn,
      p_title_ar: parsed.data.titleAr,
      p_title_en: parsed.data.titleEn,
      p_body_ar: parsed.data.bodyAr,
      p_body_en: parsed.data.bodyEn,
      p_logo_path: parsed.data.logoPath,
      p_seal_path: parsed.data.sealPath,
      p_signatures: signatures,
      p_theme: {
        style: parsed.data.style,
        primary: parsed.data.primary,
        accent: parsed.data.accent,
      },
    });
    if (error) throw new Error("create_failed");
  } catch (error) {
    if (uploaded.length) await supabase.storage.from("certificate-assets").remove(uploaded);
    go(current, "certificateError", error instanceof Error ? error.message : "create_failed");
  }
  refresh(current);
  go(current, "certificateStatus", "template_created");
}

export async function updateCertificateTemplateAction(localeValue: string, formData: FormData) {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const supabase = await createClient();
  const uploaded: string[] = [];
  try {
    const [newLogo, newSeal, newSignature] = await Promise.all([
      uploadAsset(supabase, formData.get("logo"), "logos", uploaded),
      uploadAsset(supabase, formData.get("seal"), "seals", uploaded),
      uploadAsset(supabase, formData.get("signature"), "signatures", uploaded),
    ]);
    const parsed = certificateTemplateUpdateSchema.safeParse({
      versionId: formData.get("versionId"),
      kind: formData.get("kind"),
      nameAr: formData.get("nameAr"),
      nameEn: formData.get("nameEn") ?? "",
      titleAr: formData.get("titleAr"),
      titleEn: formData.get("titleEn") ?? "",
      bodyAr: formData.get("bodyAr"),
      bodyEn: formData.get("bodyEn") ?? "",
      logoPath: newLogo || formData.get("existingLogo") || "",
      sealPath: newSeal || formData.get("existingSeal") || "",
      signerName: formData.get("signerName") ?? "",
      signerTitle: formData.get("signerTitle") ?? "",
      signaturePath: newSignature || formData.get("existingSignature") || "",
      style: formData.get("style"),
      primary: formData.get("primary"),
      accent: formData.get("accent"),
    });
    if (!parsed.success) throw new Error("invalid_template");
    const signatures = parsed.data.signerName
      ? [
          {
            name: parsed.data.signerName,
            title: parsed.data.signerTitle,
            ...(parsed.data.signaturePath ? { image_path: parsed.data.signaturePath } : {}),
          },
        ]
      : [];
    const { error } = await supabase.rpc("update_certificate_template_draft", {
      p_version: parsed.data.versionId,
      p_kind: parsed.data.kind,
      p_name_ar: parsed.data.nameAr,
      p_name_en: parsed.data.nameEn,
      p_title_ar: parsed.data.titleAr,
      p_title_en: parsed.data.titleEn,
      p_body_ar: parsed.data.bodyAr,
      p_body_en: parsed.data.bodyEn,
      p_logo_path: parsed.data.logoPath,
      p_seal_path: parsed.data.sealPath,
      p_signatures: signatures,
      p_theme: {
        style: parsed.data.style,
        primary: parsed.data.primary,
        accent: parsed.data.accent,
      },
    });
    if (error) throw new Error("update_failed");
  } catch (error) {
    if (uploaded.length) await supabase.storage.from("certificate-assets").remove(uploaded);
    go(current, "certificateError", error instanceof Error ? error.message : "update_failed");
  }
  refresh(current);
  go(current, "certificateStatus", "template_updated");
}

export async function publishCertificateTemplateAction(localeValue: string, formData: FormData) {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const parsed = certificateVersionSchema.safeParse({ versionId: formData.get("versionId") });
  if (!parsed.success) go(current, "certificateError", "invalid_version");
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_certificate_template", {
    p_version: parsed.data.versionId,
  });
  if (error) go(current, "certificateError", "publish_failed");
  refresh(current);
  go(current, "certificateStatus", "published");
}

export async function cloneCertificateTemplateAction(localeValue: string, formData: FormData) {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const parsed = certificateVersionSchema.safeParse({ versionId: formData.get("versionId") });
  if (!parsed.success) go(current, "certificateError", "invalid_version");
  const supabase = await createClient();
  const { error } = await supabase.rpc("clone_certificate_template_version", {
    p_version: parsed.data.versionId,
  });
  if (error) go(current, "certificateError", "clone_failed");
  refresh(current);
  go(current, "certificateStatus", "draft_cloned");
}

export async function issueCertificateAction(localeValue: string, formData: FormData) {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const parsed = issueCertificateSchema.safeParse({
    versionId: formData.get("versionId"),
    studentId: formData.get("studentId"),
    locale: formData.get("locale"),
    achievement: formData.get("achievement"),
  });
  if (!parsed.success) go(current, "certificateError", "invalid_issue");
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_certificate", {
    p_version: parsed.data.versionId,
    p_student: parsed.data.studentId,
    p_locale: parsed.data.locale,
    p_achievement: parsed.data.achievement,
    p_idempotency_key: `single:${randomUUID()}`,
  });
  if (error) go(current, "certificateError", "issue_failed");
  refresh(current);
  go(current, "certificateStatus", "issued");
}

export async function enqueueCertificateBatchAction(localeValue: string, formData: FormData) {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const parsed = batchCertificateSchema.safeParse({
    versionId: formData.get("versionId"),
    studentIds: formData.getAll("studentIds"),
    locale: formData.get("locale"),
    achievement: formData.get("achievement"),
  });
  if (!parsed.success) go(current, "certificateError", "invalid_batch");
  const supabase = await createClient();
  const { data: batchId, error } = await supabase.rpc("enqueue_certificate_batch", {
    p_version: parsed.data.versionId,
    p_students: parsed.data.studentIds,
    p_locale: parsed.data.locale,
    p_achievement: parsed.data.achievement,
    p_idempotency_key: `batch:${randomUUID()}`,
  });
  if (error || !batchId) go(current, "certificateError", "batch_failed");
  const { error: processError } = await supabase.rpc("process_certificate_batch", {
    p_batch: batchId,
    p_limit: 25,
  });
  if (processError) go(current, "certificateError", "batch_process_failed");
  refresh(current);
  go(current, "certificateStatus", "batch_queued");
}

export async function processCertificateBatchAction(localeValue: string, formData: FormData) {
  const current = locale(localeValue);
  await requireRole("admin", current);
  const parsed = processCertificateBatchSchema.safeParse({ batchId: formData.get("batchId") });
  if (!parsed.success) go(current, "certificateError", "invalid_batch");
  const supabase = await createClient();
  const { error } = await supabase.rpc("process_certificate_batch", {
    p_batch: parsed.data.batchId,
    p_limit: 25,
  });
  if (error) go(current, "certificateError", "batch_process_failed");
  refresh(current);
  go(current, "certificateStatus", "batch_processed");
}

async function uploadAsset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value: FormDataEntryValue | null,
  folder: "logos" | "seals" | "signatures",
  uploaded: string[],
) {
  if (!(value instanceof File) || value.size === 0) return "";
  if (value.size > 2_097_152 || !["image/png", "image/jpeg", "image/webp"].includes(value.type))
    throw new Error("invalid_asset");
  const extension =
    value.type === "image/png" ? "png" : value.type === "image/webp" ? "webp" : "jpg";
  const path = `certificates/${folder}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("certificate-assets").upload(path, value, {
    contentType: value.type,
    upsert: false,
  });
  if (error) throw new Error("asset_upload_failed");
  uploaded.push(path);
  return path;
}
