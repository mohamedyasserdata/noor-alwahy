"use client";

import { Minus, Plus, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  evaluationDraftStorageKey,
  evaluationDraftVersion,
  parseEvaluationDraft,
  type EvaluationDraft,
} from "@/lib/evaluation/draft";
import { calculateEvaluationScorePreview } from "@/lib/evaluation/score-preview";
import { submitSessionEvaluationAction } from "@/lib/evaluation/submission-actions";
import type { EvaluationTypeSettings } from "@/lib/evaluation/settings";
import type { EvaluationSessionType } from "@/lib/validators/evaluation-settings";
import { cn } from "@/lib/utils";

type Surah = { id: number; nameAr: string; nameEn: string; ayahCount: number };

const ratingLabels = {
  ar: ["إعادة", "مقبول", "جيد", "جيد جدًا", "ممتاز"],
  en: ["Repeat", "Fair", "Good", "Very good", "Excellent"],
};

export function SessionEvaluationForm({
  locale,
  sessionId,
  settings,
  surahs,
  clearSavedDraft,
}: {
  locale: AppLocale;
  sessionId: string;
  settings: EvaluationTypeSettings[];
  surahs: Surah[];
  clearSavedDraft: boolean;
}) {
  const storageKey = evaluationDraftStorageKey(sessionId);
  const [draft, setDraft] = useState<EvaluationDraft>(() => createInitialDraft(settings));
  const [restored, setRestored] = useState(false);
  const draftRef = useRef(draft);
  const activeSettings = settings.find((entry) => entry.sessionType === draft.sessionType)!;
  const fromSurah = surahs.find((surah) => surah.id === draft.fromSurah) ?? surahs[0]!;
  const toSurah = surahs.find((surah) => surah.id === draft.toSurah) ?? surahs[0]!;

  useEffect(() => {
    if (clearSavedDraft) {
      localStorage.removeItem(storageKey);
      return;
    }
    const saved = parseEvaluationDraft(localStorage.getItem(storageKey));
    if (!saved) return;
    const timeout = window.setTimeout(() => {
      draftRef.current = saved;
      setDraft(saved);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [clearSavedDraft, storageKey]);

  function updateDraft(updater: (current: EvaluationDraft) => EvaluationDraft) {
    const next = updater(draftRef.current);
    draftRef.current = next;
    setDraft(next);
    if (!clearSavedDraft) {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }

  const preview = useMemo(() => {
    try {
      return calculateEvaluationScorePreview({
        scores: draft.scores,
        weights: Object.fromEntries(
          activeSettings.criteria.map((criterion) => [criterion.code, criterion.weight]),
        ),
        errorsMajor: draft.errorsMajor,
        errorsMinor: draft.errorsMinor,
        promptsCount: draft.promptsCount,
        forgotCount: draft.forgotCount,
        deductions: {
          major: activeSettings.dMajor,
          minor: activeSettings.dMinor,
          prompt: activeSettings.dPrompt,
          forgot: activeSettings.dForgot,
        },
        thresholds: activeSettings.thresholds as [number, number, number, number, number],
      });
    } catch {
      return null;
    }
  }, [activeSettings, draft]);

  const isArabic = locale === "ar";
  const text = isArabic
    ? {
        restored: "استُعيدت مسودتك المحفوظة على هذا الجهاز.",
        type: "نوع الجلسة",
        range: "نطاق التلاوة",
        from: "من",
        to: "إلى",
        surah: "السورة",
        ayah: "الآية",
        criteria: "درجات المعايير",
        errors: "الأخطاء والمساعدة",
        major: "خطأ جلي",
        minor: "خطأ خفي",
        prompts: "تنبيه",
        forgot: "نسيان",
        details: "القرار والواجب",
        weakTags: "وسوم الضعف (افصل بفاصلة)",
        decision: "القرار",
        passed: "اجتاز",
        repeat: "يعيد",
        next: "ينتقل",
        homework: "الواجب",
        familyNote: "ملاحظة للأسرة",
        preview: "المؤشر اللحظي",
        authoritative: "النتيجة النهائية تحسبها قاعدة البيانات عند الحفظ.",
        save: "حفظ التقييم وقَفله",
        saving: "جارٍ الحفظ والقفل…",
        local: "تُحفظ المسودة تلقائيًا على هذا الجهاز حتى الاعتماد.",
      }
    : {
        restored: "Your draft on this device was restored.",
        type: "Session type",
        range: "Recitation range",
        from: "From",
        to: "To",
        surah: "Surah",
        ayah: "Ayah",
        criteria: "Criterion scores",
        errors: "Errors and assistance",
        major: "Major error",
        minor: "Minor error",
        prompts: "Prompt",
        forgot: "Forgotten",
        details: "Decision and homework",
        weakTags: "Weakness tags (comma separated)",
        decision: "Decision",
        passed: "Passed",
        repeat: "Repeat",
        next: "Move on",
        homework: "Homework",
        familyNote: "Family note",
        preview: "Live indicator",
        authoritative: "The database calculates the final result when saved.",
        save: "Save and lock evaluation",
        saving: "Saving and locking…",
        local: "The draft is saved automatically on this device until submission.",
      };

  function changeType(sessionType: EvaluationSessionType) {
    const nextSettings = settings.find((entry) => entry.sessionType === sessionType)!;
    updateDraft((current) => ({
      ...current,
      sessionType,
      scores: Object.fromEntries(nextSettings.criteria.map((criterion) => [criterion.code, 3])),
    }));
  }

  function handleScoreKey(
    event: React.KeyboardEvent<HTMLButtonElement>,
    criterionCode: string,
    score: number,
  ) {
    const horizontalStep = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const nextScore =
      event.key === "Home"
        ? 1
        : event.key === "End"
          ? 5
          : horizontalStep === 0
            ? null
            : Math.max(
                1,
                Math.min(5, score + (locale === "ar" ? -horizontalStep : horizontalStep)),
              );
    if (nextScore === null) return;
    event.preventDefault();
    updateDraft((current) => ({
      ...current,
      scores: { ...current.scores, [criterionCode]: nextScore },
    }));
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-score="${nextScore}"]`)
      ?.focus();
  }

  return (
    <form action={submitSessionEvaluationAction.bind(null, locale)} className="grid gap-7">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="sessionType" value={draft.sessionType} />
      {Object.entries(draft.scores).map(([code, score]) => (
        <input key={code} type="hidden" name={`score:${code}`} value={score} />
      ))}
      {restored ? (
        <p className="text-sm font-bold text-success" aria-live="polite">
          {text.restored}
        </p>
      ) : null}

      <fieldset>
        <legend className="text-lg font-black text-primary">{text.type}</legend>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {settings.map((entry) => (
            <Button
              key={entry.sessionType}
              type="button"
              variant={entry.sessionType === draft.sessionType ? "default" : "outline"}
              aria-pressed={entry.sessionType === draft.sessionType}
              onClick={() => changeType(entry.sessionType)}
            >
              {sessionTypeLabel(entry.sessionType, locale)}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t pt-6">
        <legend className="px-2 text-lg font-black text-primary">{text.range}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["from", "to"] as const).map((side) => {
            const selected = side === "from" ? fromSurah : toSurah;
            return (
              <div key={side} className="grid gap-3 rounded-2xl bg-accent/35 p-4">
                <p className="font-black text-primary">{text[side]}</p>
                <Label htmlFor={`${side}-surah`}>{text.surah}</Label>
                <select
                  id={`${side}-surah`}
                  name={`${side}Surah`}
                  value={selected.id}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      [`${side}Surah`]: Number(event.target.value),
                      [`${side}Ayah`]: 1,
                    }))
                  }
                  className="h-11 rounded-lg border bg-card px-3"
                >
                  {surahs.map((surah) => (
                    <option key={surah.id} value={surah.id}>
                      {surah.id}. {isArabic ? surah.nameAr : surah.nameEn}
                    </option>
                  ))}
                </select>
                <Label htmlFor={`${side}-ayah`}>{text.ayah}</Label>
                <Input
                  id={`${side}-ayah`}
                  name={`${side}Ayah`}
                  type="number"
                  min={1}
                  max={selected.ayahCount}
                  value={draft[`${side}Ayah`]}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      [`${side}Ayah`]: Number(event.target.value),
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="border-t pt-6">
        <legend className="px-2 text-lg font-black text-primary">{text.criteria}</legend>
        <div className="mt-3 grid gap-4">
          {activeSettings.criteria.map((criterion) => (
            <div
              key={criterion.code}
              className="grid gap-3 border-b pb-4 sm:grid-cols-[minmax(10rem,1fr)_auto] sm:items-center"
            >
              <p className="font-bold text-foreground">
                {isArabic ? criterion.nameAr : criterion.nameEn}
              </p>
              <div
                className="grid grid-cols-5 gap-1"
                role="radiogroup"
                aria-label={isArabic ? criterion.nameAr : criterion.nameEn}
              >
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={draft.scores[criterion.code] === score}
                    aria-label={`${score} - ${ratingLabels[locale][score - 1]}`}
                    tabIndex={draft.scores[criterion.code] === score ? 0 : -1}
                    data-score={score}
                    onKeyDown={(event) => handleScoreKey(event, criterion.code, score)}
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        scores: { ...current.scores, [criterion.code]: score },
                      }))
                    }
                    className={cn(
                      "min-h-11 min-w-11 rounded-lg border text-sm font-black",
                      draft.scores[criterion.code] === score
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card",
                    )}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t pt-6">
        <legend className="px-2 text-lg font-black text-primary">{text.errors}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Counter
            label={text.major}
            name="errorsMajor"
            value={draft.errorsMajor}
            onChange={(value) => updateDraft((current) => ({ ...current, errorsMajor: value }))}
          />
          <Counter
            label={text.minor}
            name="errorsMinor"
            value={draft.errorsMinor}
            onChange={(value) => updateDraft((current) => ({ ...current, errorsMinor: value }))}
          />
          <Counter
            label={text.prompts}
            name="promptsCount"
            value={draft.promptsCount}
            onChange={(value) => updateDraft((current) => ({ ...current, promptsCount: value }))}
          />
          <Counter
            label={text.forgot}
            name="forgotCount"
            value={draft.forgotCount}
            onChange={(value) => updateDraft((current) => ({ ...current, forgotCount: value }))}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t pt-6">
        <legend className="px-2 text-lg font-black text-primary">{text.details}</legend>
        <Label htmlFor="weak-tags">{text.weakTags}</Label>
        <Input
          id="weak-tags"
          name="weakTags"
          value={draft.weakTags}
          onChange={(event) =>
            updateDraft((current) => ({ ...current, weakTags: event.target.value }))
          }
        />
        <Label htmlFor="decision">{text.decision}</Label>
        <select
          id="decision"
          name="decision"
          value={draft.decision}
          onChange={(event) =>
            updateDraft((current) => ({
              ...current,
              decision: event.target.value as EvaluationDraft["decision"],
            }))
          }
          className="h-11 rounded-lg border bg-card px-3"
        >
          <option value="passed">{text.passed}</option>
          <option value="repeat">{text.repeat}</option>
          <option value="next">{text.next}</option>
        </select>
        <Label htmlFor="homework">{text.homework}</Label>
        <textarea
          id="homework"
          name="homework"
          rows={3}
          value={draft.homework}
          onChange={(event) =>
            updateDraft((current) => ({ ...current, homework: event.target.value }))
          }
          className="rounded-xl border bg-card p-3"
        />
        <Label htmlFor="family-note">{text.familyNote}</Label>
        <textarea
          id="family-note"
          name="familyNote"
          rows={3}
          value={draft.familyNote}
          onChange={(event) =>
            updateDraft((current) => ({ ...current, familyNote: event.target.value }))
          }
          className="rounded-xl border bg-card p-3"
        />
      </fieldset>

      <div className="grid gap-4 border-s-4 border-secondary bg-primary p-5 text-primary-foreground sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="font-black text-secondary">{text.preview}</p>
          <p className="mt-1 text-3xl font-black tabular-nums">
            {preview ? `${preview.totalScore}% · ${ratingLabels[locale][preview.rating - 1]}` : "—"}
          </p>
          <p className="mt-2 text-sm text-primary-foreground/75">
            <ShieldCheck className="me-1 inline size-4" aria-hidden="true" />
            {text.authoritative}
          </p>
          <p className="mt-1 text-xs text-primary-foreground/65">
            <Save className="me-1 inline size-3" aria-hidden="true" />
            {text.local}
          </p>
        </div>
        <AdminSubmitButton label={text.save} pendingLabel={text.saving} variant="gold" />
      </div>
    </form>
  );
}

function Counter({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-sm font-bold">{label}</p>
      <div className="mt-2 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`- ${label}`}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Input
          name={name}
          type="number"
          min={0}
          max={999}
          aria-label={label}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value)))}
          className="text-center font-black tabular-nums"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={`+ ${label}`}
          onClick={() => onChange(Math.min(999, value + 1))}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function createInitialDraft(settings: EvaluationTypeSettings[]): EvaluationDraft {
  const sessionType = "new_memo";
  const active = settings.find((entry) => entry.sessionType === sessionType)!;
  return {
    version: evaluationDraftVersion,
    sessionType,
    fromSurah: 1,
    fromAyah: 1,
    toSurah: 1,
    toAyah: 7,
    scores: Object.fromEntries(active.criteria.map((criterion) => [criterion.code, 3])),
    errorsMajor: 0,
    errorsMinor: 0,
    promptsCount: 0,
    forgotCount: 0,
    weakTags: "",
    decision: "passed",
    homework: "",
    familyNote: "",
  };
}

function sessionTypeLabel(type: EvaluationSessionType, locale: AppLocale) {
  const labels = {
    ar: {
      new_memo: "حفظ جديد",
      near_review: "مراجعة قريبة",
      far_review: "مراجعة بعيدة",
      recitation: "تلاوة",
      noorani: "نورانية",
      matn_theory: "متن ونظري",
    },
    en: {
      new_memo: "New memorization",
      near_review: "Near review",
      far_review: "Far review",
      recitation: "Recitation",
      noorani: "Noorani",
      matn_theory: "Matn and theory",
    },
  };
  return labels[locale][type];
}
