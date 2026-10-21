"use server";

import type { Route } from "next";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  createContactLinkSchema,
  deleteContactLinkSchema,
  updateContactLinkSchema,
} from "@/lib/validators/contact-links";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function redirectToSettings(locale: AppLocale, key: "error" | "status", value: string): never {
  redirect(`/${locale}/admin/settings?${new URLSearchParams({ [key]: value })}` as Route);
}

function revalidateContactPages(locale: AppLocale) {
  updateTag("public-contact-links");
  revalidatePath(`/${locale}/admin/settings`);
  revalidatePath(`/${locale}/student/contact`);
  revalidatePath(`/${locale}/parent/contact`);
  revalidatePath(`/${locale}/contact`);
}

function readFields(formData: FormData) {
  return {
    isVisible: formData.get("isVisible") === "on" ? "true" : "false",
    labelAr: formData.get("labelAr"),
    labelEn: formData.get("labelEn") || undefined,
    sortOrder: formData.get("sortOrder"),
    type: formData.get("type"),
    url: formData.get("url"),
  };
}

export async function createContactLinkAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = createContactLinkSchema.safeParse(readFields(formData));

  if (!parsed.success) {
    redirectToSettings(locale, "error", "invalid_fields");
  }

  await requireRole("admin", locale);
  const supabase = await createClient();
  const { error } = await supabase.from("contact_links").insert({
    is_visible: parsed.data.isVisible,
    label_ar: parsed.data.labelAr,
    label_en: parsed.data.labelEn,
    sort_order: parsed.data.sortOrder,
    type: parsed.data.type,
    url: parsed.data.url,
  });

  if (error) {
    redirectToSettings(locale, "error", "request_failed");
  }

  revalidateContactPages(locale);
  redirectToSettings(locale, "status", "created");
}

export async function updateContactLinkAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = updateContactLinkSchema.safeParse({
    id: formData.get("id"),
    ...readFields(formData),
  });

  if (!parsed.success) {
    redirectToSettings(locale, "error", "invalid_fields");
  }

  await requireRole("admin", locale);
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_links")
    .update({
      is_visible: parsed.data.isVisible,
      label_ar: parsed.data.labelAr,
      label_en: parsed.data.labelEn,
      sort_order: parsed.data.sortOrder,
      type: parsed.data.type,
      url: parsed.data.url,
    })
    .eq("id", parsed.data.id);

  if (error) {
    redirectToSettings(locale, "error", "request_failed");
  }

  revalidateContactPages(locale);
  redirectToSettings(locale, "status", "updated");
}

export async function deleteContactLinkAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  const parsed = deleteContactLinkSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    redirectToSettings(locale, "error", "invalid_fields");
  }

  await requireRole("admin", locale);
  const supabase = await createClient();
  const { error } = await supabase.from("contact_links").delete().eq("id", parsed.data.id);

  if (error) {
    redirectToSettings(locale, "error", "request_failed");
  }

  revalidateContactPages(locale);
  redirectToSettings(locale, "status", "deleted");
}
