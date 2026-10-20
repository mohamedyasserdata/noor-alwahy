import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  evaluationSessionTypes,
  type EvaluationSessionType,
} from "@/lib/validators/evaluation-settings";

export type EvaluationCriterion = {
  code: string;
  nameAr: string;
  nameEn: string;
  weight: number;
};

export type EvaluationTypeSettings = {
  sessionType: EvaluationSessionType;
  dMajor: number;
  dMinor: number;
  dPrompt: number;
  dForgot: number;
  thresholds: number[];
  criteria: EvaluationCriterion[];
};

export async function getEvaluationSettings(): Promise<EvaluationTypeSettings[]> {
  const supabase = await createClient();
  const [criteriaResult, settingsResult, weightsResult] = await Promise.all([
    supabase.from("eval_criteria").select("code, name_ar, name_en, sort_order").order("sort_order"),
    supabase
      .from("eval_settings")
      .select("session_type, d_major, d_minor, d_prompt, d_forgot, rating_thresholds"),
    supabase.from("eval_weights").select("session_type, criterion_code, weight"),
  ]);

  if (criteriaResult.error || settingsResult.error || weightsResult.error) {
    throw new Error("evaluation_settings_unavailable");
  }

  const criteriaByCode = new Map(
    criteriaResult.data.map((criterion) => [criterion.code, criterion]),
  );
  const settingsByType = new Map(
    settingsResult.data.map((settings) => [settings.session_type, settings]),
  );
  const weightsByType = new Map<EvaluationSessionType, typeof weightsResult.data>();

  for (const weight of weightsResult.data) {
    const sessionType = weight.session_type;
    const existing = weightsByType.get(sessionType) ?? [];
    existing.push(weight);
    weightsByType.set(sessionType, existing);
  }

  return evaluationSessionTypes.map((sessionType) => {
    const settings = settingsByType.get(sessionType);
    if (!settings || !Array.isArray(settings.rating_thresholds)) {
      throw new Error("evaluation_settings_incomplete");
    }

    const criteria = (weightsByType.get(sessionType) ?? [])
      .map((weight) => {
        const criterion = criteriaByCode.get(weight.criterion_code);
        if (!criterion) throw new Error("evaluation_criterion_missing");
        return {
          code: criterion.code,
          nameAr: criterion.name_ar,
          nameEn: criterion.name_en,
          sortOrder: criterion.sort_order,
          weight: weight.weight,
        };
      })
      .toSorted((left, right) => left.sortOrder - right.sortOrder)
      .map((criterion) => ({
        code: criterion.code,
        nameAr: criterion.nameAr,
        nameEn: criterion.nameEn,
        weight: criterion.weight,
      }));

    return {
      sessionType,
      dMajor: settings.d_major,
      dMinor: settings.d_minor,
      dPrompt: settings.d_prompt,
      dForgot: settings.d_forgot,
      thresholds: settings.rating_thresholds.map(Number),
      criteria,
    };
  });
}
