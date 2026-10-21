import { CalendarRange, Target } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { MemorizationPlanAdherence } from "@/lib/progress/memorization-plans";

type Copy = {
  title: string;
  description: string;
  empty: string;
  weekly: string;
  monthly: string;
  achieved: (achieved: string, target: string) => string;
  period: (start: string, end: string) => string;
  openEnded: string;
};

export function MemorizationPlanCard({
  locale,
  plan,
  copy,
}: {
  locale: string;
  plan: MemorizationPlanAdherence | null;
  copy: Copy;
}) {
  const numbers = new Intl.NumberFormat(locale);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <section
      className="mt-8 border-t-4 border-secondary bg-card p-5 shadow-card sm:p-7"
      aria-labelledby="memorization-plan-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <Target className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="memorization-plan-title" className="text-xl font-black text-primary">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>
      </div>
      {plan ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <PlanProgress
            label={copy.weekly}
            achieved={plan.weeklyAchievedPages}
            target={plan.weeklyTargetPages}
            percent={plan.weeklyAdherencePercent}
            numbers={numbers}
            copy={copy}
          />
          <PlanProgress
            label={copy.monthly}
            achieved={plan.monthlyAchievedPages}
            target={plan.monthlyTargetPages}
            percent={plan.monthlyAdherencePercent}
            numbers={numbers}
            copy={copy}
          />
          <p className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
            <CalendarRange className="size-4 shrink-0" aria-hidden="true" />
            {copy.period(
              dates.format(new Date(`${plan.startsOn}T00:00:00Z`)),
              plan.endsOn ? dates.format(new Date(`${plan.endsOn}T00:00:00Z`)) : copy.openEnded,
            )}
          </p>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          {copy.empty}
        </p>
      )}
    </section>
  );
}

function PlanProgress({
  label,
  achieved,
  target,
  percent,
  numbers,
  copy,
}: {
  label: string;
  achieved: number;
  target: number;
  percent: number;
  numbers: Intl.NumberFormat;
  copy: Copy;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-black text-primary">{label}</h3>
        <span className="text-lg font-black text-secondary tabular-nums">
          {numbers.format(percent)}%
        </span>
      </div>
      <Progress
        className="mt-3"
        value={percent}
        aria-label={`${label}: ${numbers.format(percent)}%`}
      />
      <p className="mt-2 text-sm text-muted-foreground">
        {copy.achieved(numbers.format(achieved), numbers.format(target))}
      </p>
    </div>
  );
}
