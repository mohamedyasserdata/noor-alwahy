"use client";

import { ArrowLeft, ArrowRight, Minus, Plus, Save, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { evaluationDraftVersion, type EvaluationDraft } from "@/lib/evaluation/draft";
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
  returnToSession = false,
  initialDraft,
}: {
  locale: AppLocale;
  sessionId: string;
  settings: EvaluationTypeSettings[];
  surahs: Surah[];
  clearSavedDraft: boolean;
  returnToSession?: boolean;
  initialDraft?: EvaluationDraft | null;
}) {
  const [draft, setDraft] = useState<EvaluationDraft>(() =>
    initialDraft && !clearSavedDraft ? initialDraft : createInitialDraft(settings),
  );
  const [reviewing, setReviewing] = useState(false);
  const draftRef = useRef(draft);
  const activeSettings = settings.find((entry) => entry.sessionType === draft.sessionType)!;
  const fromSurah = surahs.find((surah) => surah.id === draft.fromSurah) ?? surahs[0]!;
  const toSurah = surahs.find((surah) => surah.id === draft.toSurah) ?? surahs[0]!;

  function updateDraft(updater: (current: EvaluationDraft) => EvaluationDraft) {
    const next = updater(draftRef.current);
    draftRef.current = next;
    setDraft(next);
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
        restored: "استُعيدت المسودة المحفوظة في النظام ويمكنك استكمالها من أي جهاز.",
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
        saveDraft: "حفظ مسودة",
        savingDraft: "جارٍ حفظ المسودة…",
        review: "مراجعة التقييم",
        backToEdit: "العودة للتعديل",
        lock: "اعتماد التقييم ونشره",
        locking: "جارٍ الاعتماد والنشر…",
        reviewTitle: "ملخص التقييم قبل الاعتماد النهائي",
        reviewHelp: "راجع النطاق والنتيجة والملاحظات. بعد الاعتماد سيظهر التقييم للطالب والأسرة.",
        local: "المسودة تُحفظ في النظام ولا تظهر للطالب أو ولي الأمر قبل الاعتماد.",
      }
    : {
        restored: "Your system draft was restored and can be continued on another device.",
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
        saveDraft: "Save draft",
        savingDraft: "Saving draft…",
        review: "Review evaluation",
        backToEdit: "Back to editing",
        lock: "Approve and publish",
        locking: "Approving and publishing…",
        reviewTitle: "Evaluation summary before final approval",
        reviewHelp:
          "Review the range, score, and notes. Approval publishes it to the student and family.",
        local:
          "The draft is stored in the system and hidden from the student and parent until approval.",
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
      {returnToSession ? <input type="hidden" name="returnToSession" value="true" /> : null}
      <input type="hidden" name="sessionType" value={draft.sessionType} />
      {Object.entries(draft.scores).map(([code, score]) => (
        <input key={code} type="hidden" name={`score:${code}`} value={score} />
      ))}
      {initialDraft && !clearSavedDraft ? (
        <p className="text-sm font-bold text-success" aria-live="polite">
          {text.restored}
        </p>
      ) : null}

      <div className={reviewing ? "hidden" : "contents"}>
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
                    className="h-11 rounded-lg border bg-card px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
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
                        "min-h-11 min-w-11 rounded-lg border text-sm font-black focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
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
            className="h-11 rounded-lg border bg-card px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
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
            className="rounded-xl border bg-card p-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
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
            className="rounded-xl border bg-card p-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          />
        </fieldset>
      </div>

      {reviewing ? (
        <section className="rounded-2xl border border-secondary/30 bg-accent/25 p-5 sm:p-6">
          <h3 className="text-xl font-black text-primary">{text.reviewTitle}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{text.reviewHelp}</p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <ReviewItem label={text.type} value={sessionTypeLabel(draft.sessionType, locale)} />
            <ReviewItem
              label={text.range}
              value={`${isArabic ? fromSurah.nameAr : fromSurah.nameEn} ${draft.fromAyah} — ${isArabic ? toSurah.nameAr : toSurah.nameEn} ${draft.toAyah}`}
            />
            <ReviewItem
              label={text.preview}
              value={
                preview
                  ? `${preview.totalScore}% · ${ratingLabels[locale][preview.rating - 1]}`
                  : "—"
              }
            />
            <ReviewItem label={text.decision} value={text[draft.decision]} />
            <ReviewItem label={text.homework} value={draft.homework || "—"} />
            <ReviewItem label={text.familyNote} value={draft.familyNote || "—"} />
          </dl>
        </section>
      ) : null}

      <div
        className="grid gap-4 border-s-4 border-secondary bg-primary p-5 text-primary-foreground sm:grid-cols-[1fr_auto] sm:items-center"
        aria-live="polite"
        aria-atomic="true"
      >
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
        <div className="flex flex-wrap gap-2">
          {reviewing ? (
            <>
              <Button type="button" variant="outline" onClick={() => setReviewing(false)}>
                {locale === "ar" ? (
                  <ArrowRight aria-hidden="true" />
                ) : (
                  <ArrowLeft aria-hidden="true" />
                )}
                {text.backToEdit}
              </Button>
              <AdminSubmitButton
                label={text.lock}
                pendingLabel={text.locking}
                variant="gold"
                name="intent"
                value="lock"
              />
            </>
          ) : (
            <>
              <AdminSubmitButton
                label={text.saveDraft}
                pendingLabel={text.savingDraft}
                variant="outline"
                name="intent"
                value="draft"
              />
              <Button type="button" variant="gold" onClick={() => setReviewing(true)}>
                {text.review}
                {locale === "ar" ? (
                  <ArrowLeft aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-secondary/20 bg-card p-4">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-black text-foreground">{value}</dd>
    </div>
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
