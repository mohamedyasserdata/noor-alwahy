import { CalendarRange, Target } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-primary-foreground">
            <Target className="text-secondary" aria-hidden="true" />
            {t("student.title")}
          </h2>
          <CardDescription className="text-primary-foreground/70">
            {t("student.description")}
          </CardDescription>
        </div>
        <Badge className="border-[#e7c879] bg-[#fff3cf] text-[#714307]">
          <CalendarRange aria-hidden="true" />
          {t("student.active")}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-6 pt-5 sm:grid-cols-2 sm:pt-6">
        <p className="text-sm leading-6 text-muted-foreground sm:col-span-2">
          {locale === "ar"
            ? "تقدم الخطة الحالية يقارن ما أُنجز بهدف هذه الخطة فقط، ولا يساوي إجمالي الصفحات المتقنة."
            : "Current-plan progress compares achievement with this plan's target only; it is not the total mastered-page count."}
          {plan.starts_on && plan.ends_on ? ` ${plan.starts_on} — ${plan.ends_on}` : ""}
        </p>
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
        <strong className="text-2xl font-black text-[#7d500d] dark:text-secondary">
          {percent}%
        </strong>
      </div>
      <Progress value={percent} aria-label={progressLabel} />
    </div>
  );
}
