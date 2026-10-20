import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ratingThresholdsSchema } from "@/lib/validators/evaluation-settings";
import type { Database } from "@/types/database.types";

type SessionType = Database["public"]["Enums"]["session_type_t"];

export type EvaluationCriterion = {
  code: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
};

export type EvaluationSessionSettings = {
  sessionType: SessionType;
  dMajor: number;
  dMinor: number;
  dPrompt: number;
  dForgot: number;
  ratingThresholds: [number, number, number, number, number];
  weights: Array<EvaluationCriterion & { weight: number }>;
};

export async function getEvaluationSettings(): Promise<EvaluationSessionSettings[]> {
  const supabase = await createClient();
  const [criteriaResult, weightsResult, settingsResult] = await Promise.all([
    supabase
      .from("eval_criteria")
      .select("code,name_ar,name_en,sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("eval_weights").select("session_type,criterion_code,weight"),
    supabase
      .from("eval_settings")
      .select("session_type,d_major,d_minor,d_prompt,d_forgot,rating_thresholds"),
  ]);

  const error = criteriaResult.error ?? weightsResult.error ?? settingsResult.error;
  if (error) {
    throw new Error("evaluation_settings_unavailable", { cause: error });
  }

  const criteriaByCode = new Map(
    (criteriaResult.data ?? []).map((criterion) => [
      criterion.code,
      {
        code: criterion.code,
        nameAr: criterion.name_ar,
        nameEn: criterion.name_en,
        sortOrder: criterion.sort_order,
      },
    ]),
  );
  const weightsBySession = Map.groupBy(weightsResult.data ?? [], (weight) => weight.session_type);

  return (settingsResult.data ?? [])
    .map((setting) => ({
      sessionType: setting.session_type,
      dMajor: setting.d_major,
      dMinor: setting.d_minor,
      dPrompt: setting.d_prompt,
      dForgot: setting.d_forgot,
      ratingThresholds: ratingThresholdsSchema.parse(setting.rating_thresholds),
      weights: (weightsBySession.get(setting.session_type) ?? [])
        .map((weight) => {
          const criterion = criteriaByCode.get(weight.criterion_code);
          if (!criterion) throw new Error("evaluation_criterion_missing");
          return { ...criterion, weight: weight.weight };
        })
        .toSorted((left, right) => left.sortOrder - right.sortOrder),
    }))
    .toSorted((left, right) => sessionOrder(left.sessionType) - sessionOrder(right.sessionType));
}

function sessionOrder(sessionType: SessionType) {
  return ["new_memo", "near_review", "far_review", "recitation", "noorani", "matn_theory"].indexOf(
    sessionType,
  );
}
