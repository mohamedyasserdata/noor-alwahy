"use server";

import type { Route } from "next";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (formData.get("intent") === "create_account") {
    await createStudentAccountFromApplication(
      currentLocale,
      parsed.data.applicationId,
      user.id,
      supabase,
    );
  }
  revalidatePath(`/${currentLocale}/admin/applications`);
  redirect(destination(currentLocale, "applicationStatus", "placement_saved"));
}

async function createStudentAccountFromApplication(
  currentLocale: AppLocale,
  applicationId: string,
  adminId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<never> {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("student_name,student_gender,contact_email,status")
    .eq("id", applicationId)
    .single();
  if (applicationError || !application)
    redirect(destination(currentLocale, "applicationError", "conversion_failed"));
  if (!application.contact_email)
    redirect(destination(currentLocale, "applicationError", "email_required"));
  if (application.status === "rejected")
    redirect(destination(currentLocale, "applicationError", "not_accepted"));

  if (application.status === "new" || application.status === "postponed") {
    const { error } = await supabase
      .from("applications")
      .update({ status: "contacted" })
      .eq("id", applicationId);
    if (error) redirect(destination(currentLocale, "applicationError", "conversion_failed"));
  }
  if (application.status !== "accepted") {
    const { error } = await supabase
      .from("applications")
      .update({ status: "accepted" })
      .eq("id", applicationId);
    if (error) redirect(destination(currentLocale, "applicationError", "conversion_failed"));
  }

  const { data: studentId, error: conversionError } = await supabase.rpc(
    "convert_application_to_student",
    { p_application: applicationId },
  );
  if (conversionError || !studentId)
    redirect(destination(currentLocale, "applicationError", "conversion_failed"));

  const { data: student } = await supabase
    .from("students")
    .select("profile_id")
    .eq("id", studentId)
    .single();
  if (!student?.profile_id) {
    const requestHeaders = await headers();
    const originHeader = requestHeaders.get("origin");
    if (!originHeader) redirect(destination(currentLocale, "applicationError", "account_failed"));
    const callback = new URL(`/${currentLocale}/auth/accept-invite`, new URL(originHeader).origin);
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      application.contact_email,
      {
        data: {
          created_by: adminId,
          full_name: application.student_name,
          gender: application.student_gender,
          role: "student",
          student_id: studentId,
        },
        redirectTo: callback.toString(),
      },
    );
    if (inviteError) {
      const code = /already|registered|exists/i.test(inviteError.message)
        ? "account_exists"
        : "account_failed";
      redirect(destination(currentLocale, "applicationError", code));
    }
  }

  revalidatePath(`/${currentLocale}/admin/applications`);
  revalidatePath(`/${currentLocale}/admin/students`);
  revalidatePath(`/${currentLocale}/admin/users`);
  revalidatePath(`/${currentLocale}/admin/audit`);
  redirect(
    `/${currentLocale}/admin/students?${new URLSearchParams({ student: studentId, familyStatus: "student_invited" })}` as Route,
  );
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
