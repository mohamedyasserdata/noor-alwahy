"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const transitionSchema = z.object({
  caseId: z.string().uuid(),
  status: z.enum(["acknowledged", "resolved", "dismissed"]),
  reason: z.string().trim().max(500),
});

const ruleSchema = z.object({
  ruleId: z.string().uuid(),
  ruleType: z.enum([
    "student_struggle",
    "student_absence",
    "teacher_late",
    "renewal_due",
    "payment_overdue",
    "report_pending",
    "credit_exhausted",
  ]),
  priority: z.coerce.number().int().min(1).max(5),
  windowDays: z.coerce.number().int().min(1).max(365),
  cooldownDays: z.coerce.number().int().min(0).max(365),
  thresholdA: z.coerce.number().int().min(0).max(365),
  thresholdB: z.coerce.number().int().min(0).max(120).optional(),
  enabled: z.boolean(),
});

export async function transitionInterventionAction(
  locale: AppLocale,
  caseId: string,
  status: "acknowledged" | "resolved" | "dismissed",
  formData: FormData,
) {
  await requireRole("admin", locale);
  const input = transitionSchema.parse({ caseId, status, reason: formData.get("reason") ?? "" });
  if (input.status === "dismissed" && input.reason.length < 2) {
    throw new Error("intervention_reason_required");
  }
  if (input.reason.length === 1) throw new Error("intervention_reason_invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_intervention_case", {
    p_case: input.caseId,
    p_status: input.status,
    p_reason: input.reason || undefined,
  });
  if (error) throw new Error("intervention_transition_failed");
  revalidatePath(`/${locale}/admin/control-center`);
}

export async function saveInterventionRuleAction(locale: AppLocale, formData: FormData) {
  await requireRole("admin", locale);
  const input = ruleSchema.parse({
    ruleId: formData.get("ruleId"),
    ruleType: formData.get("ruleType"),
    priority: formData.get("priority"),
    windowDays: formData.get("windowDays"),
    cooldownDays: formData.get("cooldownDays"),
    thresholdA: formData.get("thresholdA"),
    thresholdB: formData.get("thresholdB") || undefined,
    enabled: formData.get("enabled") === "on",
  });
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_intervention_rule", {
    p_rule_type: input.ruleType,
    p_priority: input.priority,
    p_thresholds: thresholdsFor(input),
    p_window_interval: `${input.windowDays} days`,
    p_cooldown_interval: `${input.cooldownDays} days`,
    p_is_enabled: input.enabled,
    p_rule_id: input.ruleId,
  });
  if (error) throw new Error("intervention_rule_save_failed");
  revalidatePath(`/${locale}/admin/control-center`);
}

function thresholdsFor(input: z.infer<typeof ruleSchema>) {
  if (input.ruleType === "student_struggle")
    return { max_average: input.thresholdA, min_evaluations: input.thresholdB ?? 1 };
  if (input.ruleType === "student_absence") return { min_absences: input.thresholdA };
  if (input.ruleType === "teacher_late")
    return { min_late_minutes: input.thresholdA, min_occurrences: input.thresholdB ?? 1 };
  if (input.ruleType === "renewal_due") return { days_before: input.thresholdA };
  if (input.ruleType === "payment_overdue") return { days_overdue: input.thresholdA };
  if (input.ruleType === "report_pending") return { days_pending: input.thresholdA };
  return { max_remaining: input.thresholdA };
}
