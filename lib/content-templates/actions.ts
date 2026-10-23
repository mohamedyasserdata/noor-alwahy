"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const templateSchema = z.object({
  templateId: z.union([z.literal(""), z.string().uuid()]),
  kind: z.enum(["student_report", "admin_message", "announcement"]),
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().max(120),
  subjectAr: z.string().trim().max(200),
  bodyAr: z.string().trim().min(2).max(6000),
  subjectEn: z.string().trim().max(200),
  bodyEn: z.string().trim().min(2).max(6000),
});

const idSchema = z.string().uuid();

export async function saveContentTemplateAction(localeValue: string, formData: FormData) {
  const locale = safeLocale(localeValue);
  await requireRole("admin", locale);
  const input = templateSchema.safeParse({
    templateId: formData.get("templateId") ?? "",
    kind: formData.get("kind"),
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn") ?? "",
    subjectAr: formData.get("subjectAr") ?? "",
    bodyAr: formData.get("bodyAr"),
    subjectEn: formData.get("subjectEn") ?? "",
    bodyEn: formData.get("bodyEn"),
  });
  if (!input.success) go(locale, "invalid_fields");
  if (input.data.kind !== "student_report" && (!input.data.subjectAr || !input.data.subjectEn)) {
    go(locale, "subject_required");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_content_template", {
    p_template: input.data.templateId || undefined,
    p_kind: input.data.kind,
    p_name_ar: input.data.nameAr,
    p_name_en: input.data.nameEn,
    p_subject_ar: input.data.subjectAr,
    p_body_ar: input.data.bodyAr,
    p_subject_en: input.data.subjectEn,
    p_body_en: input.data.bodyEn,
  });
  if (error) go(locale, "save_failed");
  revalidatePath(`/${locale}/admin/templates`);
  go(locale, "saved", "templateStatus");
}

export async function publishContentTemplateAction(localeValue: string, formData: FormData) {
  const locale = safeLocale(localeValue);
  await requireRole("admin", locale);
  const id = idSchema.safeParse(formData.get("templateId"));
  if (!id.success) go(locale, "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_content_template", { p_template: id.data });
  if (error) go(locale, "publish_failed");
  revalidatePath(`/${locale}/admin/templates`);
  go(locale, "published", "templateStatus");
}

export async function archiveContentTemplateAction(localeValue: string, formData: FormData) {
  const locale = safeLocale(localeValue);
  await requireRole("admin", locale);
  const id = idSchema.safeParse(formData.get("templateId"));
  if (!id.success) go(locale, "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_content_template", { p_template: id.data });
  if (error) go(locale, "archive_failed");
  revalidatePath(`/${locale}/admin/templates`);
  go(locale, "archived", "templateStatus");
}

function safeLocale(value: string) {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(locale: AppLocale, value: string, key = "templateError"): never {
  redirect(`/${locale}/admin/templates?${key}=${value}` as Route);
}
