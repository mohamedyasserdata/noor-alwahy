"use server";

import { randomUUID } from "node:crypto";
import type { Route } from "next";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  packageIdSchema,
  packageOrderSchema,
  packageWizardSchema,
} from "@/lib/validators/packages";

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function destination(locale: AppLocale, key: "packageError" | "packageStatus", value: string) {
  return `/${locale}/admin/packages?${new URLSearchParams({ [key]: value })}` as Route;
}

function refreshPackages(locale: AppLocale) {
  updateTag("public-packages");
  revalidatePath(`/${locale}/admin/packages`);
  revalidatePath(`/${locale}`);
}

export async function savePackageAction(localeValue: string, formData: FormData): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const raw = formData.get("payload");
  let payload: unknown;
  try {
    payload = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    redirect(destination(locale, "packageError", "invalid_fields"));
  }
  const supabase = await createClient();
  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("id")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (trackError || !track || !payload || typeof payload !== "object" || Array.isArray(payload))
    redirect(destination(locale, "packageError", "invalid_fields"));
  const rawPayload = payload as Record<string, unknown>;
  const normalized = {
    ...rawPayload,
    slug:
      typeof rawPayload.slug === "string" && rawPayload.slug
        ? rawPayload.slug
        : `package-${randomUUID().slice(0, 8)}`,
    track_id: track.id,
    audience: "all",
    teacher_gender: "",
    prices: Array.isArray(rawPayload.prices)
      ? rawPayload.prices.map((price) =>
          price && typeof price === "object"
            ? { ...(price as Record<string, unknown>), min_amount: "", max_amount: "" }
            : price,
        )
      : rawPayload.prices,
  };
  const parsed = packageWizardSchema.safeParse(normalized);
  if (!parsed.success) redirect(destination(locale, "packageError", "invalid_fields"));

  const { error } = await supabase.rpc("save_package", { p_payload: parsed.data });
  if (error) {
    const code = error.message.includes("package_slug_exists")
      ? "slug_exists"
      : error.message.includes("package_not_found")
        ? "not_found"
        : "save_failed";
    redirect(destination(locale, "packageError", code));
  }
  refreshPackages(locale);
  redirect(destination(locale, "packageStatus", parsed.data.is_published ? "published" : "saved"));
}

export async function clonePackageAction(localeValue: string, formData: FormData): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = packageIdSchema.safeParse(formData.get("packageId"));
  if (!parsed.success) redirect(destination(locale, "packageError", "invalid_fields"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("clone_package", { p_package: parsed.data });
  if (error) redirect(destination(locale, "packageError", "clone_failed"));
  refreshPackages(locale);
  redirect(destination(locale, "packageStatus", "cloned"));
}

export async function togglePackageAction(localeValue: string, formData: FormData): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsedId = packageIdSchema.safeParse(formData.get("packageId"));
  const publish = formData.get("publish") === "true";
  if (!parsedId.success) redirect(destination(locale, "packageError", "invalid_fields"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("packages")
    .update({ is_published: publish })
    .eq("id", parsedId.data);
  if (error) redirect(destination(locale, "packageError", "publication_failed"));
  refreshPackages(locale);
  redirect(destination(locale, "packageStatus", publish ? "published" : "hidden"));
}

export async function reorderPackagesAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  let ids: unknown;
  try {
    const raw = formData.get("packageIds");
    ids = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    redirect(destination(locale, "packageError", "invalid_order"));
  }
  const parsed = packageOrderSchema.safeParse(ids);
  if (!parsed.success) redirect(destination(locale, "packageError", "invalid_order"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_packages", { p_package_ids: parsed.data });
  if (error) redirect(destination(locale, "packageError", "reorder_failed"));
  refreshPackages(locale);
  redirect(destination(locale, "packageStatus", "reordered"));
}
