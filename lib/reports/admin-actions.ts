"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const transitionSchema = z.object({
  reportId: z.uuid(),
  status: z.enum(["approved", "admin_review", "visible", "draft"]),
});

export async function transitionReportAction(localeValue: string, formData: FormData) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  await requireRole("admin", locale);
  const parsed = transitionSchema.safeParse({
    reportId: formData.get("reportId"),
    status: formData.get("status"),
  });
  if (!parsed.success) go(locale, "invalid_fields");
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.reportId);
  if (error) go(locale, "request_failed");
  revalidatePath(`/${locale}/admin/reports`);
  revalidatePath(`/${locale}/parent/children`);
  revalidatePath(`/${locale}/student/progress`);
  redirect(`/${locale}/admin/reports?reportStatus=updated` as Route);
}

function go(locale: AppLocale, code: string): never {
  redirect(`/${locale}/admin/reports?reportError=${code}` as Route);
}
