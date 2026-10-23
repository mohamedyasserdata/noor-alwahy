"use server";

import type { Route } from "next";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { readPackageImportFile } from "@/lib/packages/import-reader";
import { createClient } from "@/lib/supabase/server";
import {
  validatePackageImportRows,
  type PackageImportError,
} from "@/lib/validators/package-import";

export type PackageImportState = {
  batchId?: string;
  errors: PackageImportError[];
  fileError?: string;
  preview: Array<{ slug: string; nameAr: string; priceCount: number; published: boolean }>;
};

const emptyState: PackageImportState = { errors: [], preview: [] };

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

export async function previewPackageImportAction(
  localeValue: string,
  _previous: PackageImportState,
  formData: FormData,
): Promise<PackageImportState> {
  const locale = parseLocale(localeValue);
  const { user } = await requireRole("admin", locale);
  const file = formData.get("workbook");
  if (!(file instanceof File)) return { ...emptyState, fileError: "invalid_file" };

  let rows: string[][];
  try {
    rows = await readPackageImportFile(file);
  } catch (error) {
    return { ...emptyState, fileError: error instanceof Error ? error.message : "invalid_file" };
  }

  const supabase = await createClient();
  const [tracksResult, countriesResult, packagesResult] = await Promise.all([
    supabase.from("tracks").select("id,code").eq("is_active", true),
    supabase.from("countries").select("code,currency").eq("is_enabled", true),
    supabase.from("packages").select("id,slug"),
  ]);
  if (tracksResult.error || countriesResult.error || packagesResult.error)
    return { ...emptyState, fileError: "request_failed" };
  const validFrom = DateTime.utc().toISO();
  if (!validFrom) return { ...emptyState, fileError: "request_failed" };
  const result = validatePackageImportRows(rows, {
    tracks: tracksResult.data ?? [],
    countries: countriesResult.data ?? [],
    packages: packagesResult.data ?? [],
    validFrom,
  });
  if (result.errors.length) return { errors: result.errors, preview: [] };

  const priceCount = result.payload.reduce((total, item) => total + item.prices.length, 0);
  const { data: batch, error } = await supabase
    .from("package_import_batches")
    .insert({
      created_by: user.id,
      source_name: file.name.slice(0, 180),
      package_count: result.payload.length,
      price_count: priceCount,
      payload: result.payload,
    })
    .select("id")
    .single();
  if (error || !batch) return { ...emptyState, fileError: "request_failed" };

  return {
    batchId: batch.id,
    errors: [],
    preview: result.payload.map((item) => ({
      slug: item.slug,
      nameAr: item.name_ar,
      priceCount: item.prices.length,
      published: item.is_published,
    })),
  };
}

export async function confirmPackageImportAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = z.uuid().safeParse(formData.get("batchId"));
  if (!parsed.success) redirect(`/${locale}/admin/packages?packageError=invalid_batch` as Route);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_package_import", { p_batch_id: parsed.data });
  if (error) {
    const code = error.message.includes("pending_import_not_found")
      ? "invalid_batch"
      : "import_failed";
    redirect(`/${locale}/admin/packages?packageError=${code}` as Route);
  }
  updateTag("public-packages");
  revalidatePath(`/${locale}/admin/packages`);
  revalidatePath(`/${locale}/packages`);
  revalidatePath(`/${locale}`);
  redirect(`/${locale}/admin/packages?packageStatus=imported&count=${data}` as Route);
}
