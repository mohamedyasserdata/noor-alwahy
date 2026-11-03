"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const pageSchema = z.enum(["students", "control-center", "reports"]);
const querySchema = z
  .record(z.string().max(40), z.string().max(200))
  .refine((value) => Object.keys(value).length <= 16, "too_many_filters");

export async function saveAdminViewAction(locale: AppLocale, formData: FormData) {
  const { user } = await requireRole("admin", locale);
  const pageKey = pageSchema.parse(formData.get("pageKey"));
  const name = z.string().trim().min(2).max(80).parse(formData.get("name"));
  const queryParams = querySchema.parse(JSON.parse(String(formData.get("queryParams") ?? "{}")));
  const supabase = await createClient();
  const { error } = await supabase.from("admin_saved_views").upsert(
    {
      profile_id: user.id,
      page_key: pageKey,
      name,
      query_params: queryParams,
    },
    { onConflict: "profile_id,page_key,name" },
  );
  if (error) throw new Error("admin_saved_view_save_failed");
  revalidate(pageKey, locale);
}

export async function deleteAdminViewAction(locale: AppLocale, formData: FormData) {
  const { user } = await requireRole("admin", locale);
  const pageKey = pageSchema.parse(formData.get("pageKey"));
  const viewId = z.uuid().parse(formData.get("viewId"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_saved_views")
    .delete()
    .eq("id", viewId)
    .eq("profile_id", user.id)
    .eq("page_key", pageKey);
  if (error) throw new Error("admin_saved_view_delete_failed");
  revalidate(pageKey, locale);
}

function revalidate(pageKey: z.infer<typeof pageSchema>, locale: AppLocale) {
  revalidatePath(`/${locale}/admin/${pageKey}`);
}
