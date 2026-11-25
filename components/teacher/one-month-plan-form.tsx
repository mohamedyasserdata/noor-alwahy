"use client";

import { useMemo, useState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { saveMemorizationPlanAction } from "@/lib/memorization-plans/actions";

export function OneMonthPlanForm({
  locale,
  studentId,
  initialMonthlyTarget,
  initialStart,
  saveLabel,
  savingLabel,
}: {
  locale: AppLocale;
  studentId: string;
  initialMonthlyTarget: number;
  initialStart: string;
  saveLabel: string;
  savingLabel: string;
}) {
  const [monthlyTarget, setMonthlyTarget] = useState(initialMonthlyTarget);
  const [startsOn, setStartsOn] = useState(initialStart);
  const weeklyPace = Math.max(1, Math.ceil(monthlyTarget / 4));
  const endsOn = useMemo(() => monthEnd(startsOn), [startsOn]);
  const ar = locale === "ar";

  return (
    <form
      action={saveMemorizationPlanAction.bind(null, locale)}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="returnToProfile" value="true" />
      <input type="hidden" name="weeklyTargetPages" value={weeklyPace} />
      <input type="hidden" name="endsOn" value={endsOn} />
      <div className="grid gap-2">
        <Label htmlFor="monthly-plan-target">
          {ar ? "هدف الشهر (صفحات)" : "Monthly target (pages)"}
        </Label>
        <Input
          id="monthly-plan-target"
          name="monthlyTargetPages"
          type="number"
          min={1}
          max={604}
          value={monthlyTarget}
          onChange={(event) => setMonthlyTarget(Number(event.target.value) || 1)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="monthly-plan-start">{ar ? "تاريخ البداية" : "Start date"}</Label>
        <Input
          id="monthly-plan-start"
          name="startsOn"
          type="date"
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
          required
        />
      </div>
      <div className="rounded-xl border bg-background/65 px-4 py-3">
        <span className="text-xs font-bold text-muted-foreground">
          {ar ? "المعدل الأسبوعي المقترح" : "Suggested weekly pace"}
        </span>
        <strong className="mt-1 block text-primary">
          {weeklyPace} {ar ? "صفحة" : "pages"}
        </strong>
      </div>
      <div className="rounded-xl border bg-background/65 px-4 py-3">
        <span className="text-xs font-bold text-muted-foreground">
          {ar ? "نهاية الشهر" : "Plan end"}
        </span>
        <strong className="mt-1 block text-primary" dir="ltr">
          {endsOn}
        </strong>
      </div>
      <div className="sm:col-span-2">
        <AdminSubmitButton label={saveLabel} pendingLabel={savingLabel} />
      </div>
    </form>
  );
}

function monthEnd(startsOn: string) {
  const parsed = new Date(`${startsOn}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  const day = parsed.getUTCDate();
  parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  if (parsed.getUTCDate() !== day) parsed.setUTCDate(0);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}
