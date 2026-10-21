"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  applicationIdSchema,
  applicationWorkflowSchema,
  placementSchema,
} from "@/lib/validators/application-crm";

function locale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}
function destination(value: AppLocale, key: string, message: string) {
  return `/${value}/admin/applications?${new URLSearchParams({ [key]: message })}` as Route;
}

export async function updateApplicationAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = applicationWorkflowSchema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status"),
    internalNotes: formData.get("internalNotes"),
  });
  if (!parsed.success) redirect(destination(currentLocale, "applicationError", "invalid_fields"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("applications")
    .update({ status: parsed.data.status, internal_notes: parsed.data.internalNotes || null })
    .eq("id", parsed.data.applicationId);
  if (error)
    redirect(
      destination(
        currentLocale,
        "applicationError",
        error.message.includes("invalid_application_transition")
          ? "invalid_transition"
          : "update_failed",
      ),
    );
  revalidatePath(`/${currentLocale}/admin/applications`);
  redirect(destination(currentLocale, "applicationStatus", "updated"));
}

export async function savePlacementAction(localeValue: string, formData: FormData): Promise<never> {
  const currentLocale = locale(localeValue);
  const { user } = await requireRole("admin", currentLocale);
  const parsed = placementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    redirect(destination(currentLocale, "applicationError", "invalid_placement"));
  const supabase = await createClient();
  const { error } = await supabase.from("placement_tests").insert({
    application_id: parsed.data.applicationId,
    evaluator_id: user.id,
    recitation_score: parsed.data.recitationScore,
    tajweed_score: parsed.data.tajweedScore,
    memorization_score: parsed.data.memorizationScore,
    recommended_track_id: parsed.data.recommendedTrackId || null,
    recommended_package_id: parsed.data.recommendedPackageId || null,
    notes: parsed.data.notes || null,
  });
  if (error) redirect(destination(currentLocale, "applicationError", "placement_failed"));
  revalidatePath(`/${currentLocale}/admin/applications`);
  redirect(destination(currentLocale, "applicationStatus", "placement_saved"));
}

export async function convertApplicationAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const currentLocale = locale(localeValue);
  await requireRole("admin", currentLocale);
  const parsed = applicationIdSchema.safeParse(formData.get("applicationId"));
  if (!parsed.success) redirect(destination(currentLocale, "applicationError", "invalid_fields"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_application_to_student", {
    p_application: parsed.data,
  });
  if (error || !data)
    redirect(
      destination(
        currentLocale,
        "applicationError",
        error?.message.includes("not_accepted") ? "not_accepted" : "conversion_failed",
      ),
    );
  revalidatePath(`/${currentLocale}/admin/applications`);
  revalidatePath(`/${currentLocale}/admin/students`);
  redirect(`/${currentLocale}/admin/students?student=${data}&studentStatus=created` as Route);
}
