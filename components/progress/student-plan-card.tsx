import { CalendarRange, Target } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/routing";
import type { PlanAdherence } from "@/lib/memorization-plans/queries";

export async function StudentPlanCard({
  locale,
  plan,
}: {
  locale: AppLocale;
  plan: PlanAdherence | null;
}) {
  const t = await getTranslations({ locale, namespace: "memorizationPlan" });

  if (!plan) {
    return (
      <Card className="mt-8 border-dashed shadow-none">
        <CardHeader>
          <h2 className="text-lg font-extrabold tracking-tight text-primary">
            {t("student.emptyTitle")}
          </h2>
          <CardDescription>{t("student.emptyDescription")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const weeklyPercent = Number(plan.weekly_adherence_percent ?? 0);
  const monthlyPercent = Number(plan.monthly_adherence_percent ?? 0);

  return (
    <Card className="mt-8 overflow-hidden border-secondary/30">
      <CardHeader className="border-b bg-primary text-primary-foreground sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-primary-foreground">
            <Target className="text-secondary" aria-hidden="true" />
            {t("student.title")}
          </CardTitle>
          <CardDescription className="text-primary-foreground/70">
            {t("student.description")}
          </CardDescription>
        </div>
        <Badge variant="secondary">
          <CalendarRange aria-hidden="true" />
          {t("student.active")}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-6 pt-5 sm:grid-cols-2 sm:pt-6">
        <PlanProgress
          label={t("weekly")}
          achieved={plan.weekly_achieved_pages ?? 0}
          target={plan.weekly_target_pages ?? 0}
          percent={weeklyPercent}
          progressLabel={t("progressLabel", { percent: weeklyPercent })}
          pagesLabel={t("pagesOfTarget", {
            achieved: plan.weekly_achieved_pages ?? 0,
            target: plan.weekly_target_pages ?? 0,
          })}
        />
        <PlanProgress
          label={t("monthly")}
          achieved={plan.monthly_achieved_pages ?? 0}
          target={plan.monthly_target_pages ?? 0}
          percent={monthlyPercent}
          progressLabel={t("progressLabel", { percent: monthlyPercent })}
          pagesLabel={t("pagesOfTarget", {
            achieved: plan.monthly_achieved_pages ?? 0,
            target: plan.monthly_target_pages ?? 0,
          })}
        />
      </CardContent>
    </Card>
  );
}

function PlanProgress({
  label,
  percent,
  progressLabel,
  pagesLabel,
}: {
  label: string;
  achieved: number;
  target: number;
  percent: number;
  progressLabel: string;
  pagesLabel: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-black text-primary">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{pagesLabel}</p>
        </div>
        <strong className="text-2xl font-black text-secondary">{percent}%</strong>
      </div>
      <Progress value={percent} aria-label={progressLabel} />
    </div>
  );
}
