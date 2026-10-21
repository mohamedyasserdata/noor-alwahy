"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  announcementAudience,
  announcementDraftSchema,
  announcementTransitionSchema,
} from "@/lib/validators/announcement";

export async function saveAnnouncementAction(localeValue: string, formData: FormData) {
  const locale = safeLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = announcementDraftSchema.safeParse({
    announcementId: formData.get("announcementId"),
    titleAr: formData.get("titleAr"),
    titleEn: formData.get("titleEn"),
    bodyAr: formData.get("bodyAr"),
    bodyEn: formData.get("bodyEn"),
    all: formData.get("all") === "on",
    roles: formData.getAll("roles"),
    countries: formData.getAll("countries"),
    levelIds: formData.getAll("levelIds"),
    trackIds: formData.getAll("trackIds"),
    endsOn: formData.get("endsOn"),
  });
  if (!parsed.success) go(locale, "invalid_fields");

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_admin_announcement", {
    p_id: parsed.data.announcementId,
    p_title_ar: parsed.data.titleAr,
    p_title_en: parsed.data.titleEn ?? "",
    p_body_ar: parsed.data.bodyAr,
    p_body_en: parsed.data.bodyEn ?? "",
    p_audience: announcementAudience(parsed.data),
    p_starts_at: new Date().toISOString(),
    p_ends_at: parsed.data.endsOn ? `${parsed.data.endsOn}T23:59:59.999Z` : undefined,
  });
  if (error) go(locale, "save_failed");
  revalidatePath(`/${locale}/admin/announcements`);
  redirect(`/${locale}/admin/announcements?announcementStatus=saved` as Route);
}

export async function publishAnnouncementAction(localeValue: string, formData: FormData) {
  const locale = safeLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = announcementTransitionSchema.safeParse({
    announcementId: formData.get("announcementId"),
  });
  if (!parsed.success) go(locale, "invalid_fields");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_admin_announcement", {
    p_id: parsed.data.announcementId,
  });
  if (error) go(locale, "publish_failed");
  revalidatePath("/", "layout");
  redirect(
    `/${locale}/admin/announcements?announcementStatus=published&delivered=${data ?? 0}` as Route,
  );
}

export async function archiveAnnouncementAction(localeValue: string, formData: FormData) {
  const locale = safeLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = announcementTransitionSchema.safeParse({
    announcementId: formData.get("announcementId"),
  });
  if (!parsed.success) go(locale, "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_admin_announcement", {
    p_id: parsed.data.announcementId,
  });
  if (error) go(locale, "archive_failed");
  revalidatePath(`/${locale}/admin/announcements`);
  redirect(`/${locale}/admin/announcements?announcementStatus=archived` as Route);
}

function safeLocale(value: string) {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function go(locale: AppLocale, code: string): never {
  redirect(`/${locale}/admin/announcements?announcementError=${code}` as Route);
}
