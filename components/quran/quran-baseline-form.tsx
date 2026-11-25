"use client";

import { ArrowDownUp, BookMarked, Flag, History } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  saveAdminQuranBaselineAction,
  saveTeacherQuranBaselineAction,
} from "@/lib/quran/baseline-actions";
import type { QuranLocationOption } from "@/lib/quran/location-options";
import { cn } from "@/lib/utils";

type Baseline = {
  prior_memorized_from_page: number | null;
  prior_memorized_to_page: number | null;
  academy_start_page: number | null;
  study_direction: string;
  assessed_on: string;
  assessment_notes: string | null;
} | null;

export function QuranBaselineForm({
  locale,
  studentId,
  role,
  surahs,
  baseline,
}: {
  locale: AppLocale;
  studentId: string;
  role: "admin" | "teacher";
  surahs: QuranLocationOption[];
  baseline: Baseline;
}) {
  const ar = locale === "ar";
  const [priorFrom, setPriorFrom] = useState<number | "">(
    baseline?.prior_memorized_from_page ?? "",
  );
  const [priorTo, setPriorTo] = useState<number | "">(baseline?.prior_memorized_to_page ?? "");
  const [academyStart, setAcademyStart] = useState<number | "">(baseline?.academy_start_page ?? "");
  const action = role === "admin" ? saveAdminQuranBaselineAction : saveTeacherQuranBaselineAction;

  function updatePriorFrom(value: number | "") {
    setPriorFrom(value);
    if (value === "") setPriorTo("");
    else if (priorTo === "") setPriorTo(value);
  }

  return (
    <form
      action={action.bind(null, locale)}
      className="overflow-hidden rounded-[1.5rem] border border-[#d8bd83] bg-background/55"
    >
      <input type="hidden" name="studentId" value={studentId} />
      <header className="border-b border-[#e4d2aa] bg-[#fff9eb] px-4 py-5 sm:px-6 dark:bg-[#382d19]">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#102d58] text-[#e9bd56]">
            <BookMarked className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-lg font-black text-primary">
              {ar ? "خط البداية القرآني" : "Quran starting point"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {ar
                ? "سجّل ما كان الطالب يحفظه قبل الانضمام، ثم حدّد الموضع الذي ستبدأ منه خطة الأكاديمية. المحفوظ السابق لا يُحسب ضمن إنجاز الأكاديمية."
                : "Record what the student knew before joining, then set where the academy plan begins. Prior memorisation is not counted as academy achievement."}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-5 p-4 sm:p-6">
        <section className="grid gap-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <History className="size-5 text-[#b98010]" aria-hidden="true" />
            <h4 className="font-black">{ar ? "المحفوظ قبل الأكاديمية" : "Prior memorisation"}</h4>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {ar
              ? "اتركه بلا تحديد إذا كان الطالب سيبدأ الحفظ من الصفر."
              : "Leave this empty when the student starts memorising from scratch."}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <LocationPicker
              locale={locale}
              label={ar ? "بداية المحفوظ السابق" : "Prior range starts"}
              name="priorFromPage"
              value={priorFrom}
              onChange={updatePriorFrom}
              surahs={surahs}
              allowEmpty
            />
            <LocationPicker
              locale={locale}
              label={ar ? "آخر ما وصل إليه" : "Prior range ends"}
              name="priorToPage"
              value={priorTo}
              onChange={setPriorTo}
              surahs={surahs}
              disabled={priorFrom === ""}
              allowEmpty
            />
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-[#d8bd83] bg-[#fffaf0] p-4 dark:bg-[#332b1c]">
          <div className="flex items-center gap-2 text-primary">
            <Flag className="size-5 text-[#b98010]" aria-hidden="true" />
            <h4 className="font-black">
              {ar ? "بداية الطالب داخل الأكاديمية" : "Academy starting point"}
            </h4>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <LocationPicker
              locale={locale}
              label={ar ? "ابدأ الخطة من" : "Start the plan from"}
              name="academyStartPage"
              value={academyStart}
              onChange={setAcademyStart}
              surahs={surahs}
              allowEmpty
            />
            <div className="grid gap-2">
              <Label htmlFor={`study-direction-${role}`} className="flex items-center gap-2">
                <ArrowDownUp className="size-4 text-[#b98010]" aria-hidden="true" />
                {ar ? "اتجاه الحفظ" : "Memorisation direction"}
              </Label>
              <select
                id={`study-direction-${role}`}
                name="studyDirection"
                defaultValue={baseline?.study_direction ?? "ascending"}
                className="min-h-11 rounded-xl border bg-background px-3 text-sm font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ascending">
                  {ar ? "من أول المصحف إلى آخره" : "From the beginning to the end"}
                </option>
                <option value="descending">
                  {ar ? "من آخر المصحف إلى أوله" : "From the end to the beginning"}
                </option>
              </select>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="grid gap-2">
            <Label htmlFor={`baseline-assessed-on-${role}`}>
              {ar ? "تاريخ تحديد المستوى" : "Assessment date"}
            </Label>
            <Input
              id={`baseline-assessed-on-${role}`}
              name="assessedOn"
              type="date"
              defaultValue={baseline?.assessed_on ?? new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`baseline-notes-${role}`}>
              {ar ? "ملاحظات التقييم (اختياري)" : "Assessment notes (optional)"}
            </Label>
            <textarea
              id={`baseline-notes-${role}`}
              name="assessmentNotes"
              defaultValue={baseline?.assessment_notes ?? ""}
              maxLength={1200}
              rows={3}
              placeholder={
                ar
                  ? "مثال: يحفظ سورًا متفرقة أو يحتاج تثبيت جزء محدد…"
                  : "Example: knows separate surahs or needs to reinforce a specific juz…"
              }
              className="min-h-24 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs leading-5 text-muted-foreground">
            {ar
              ? "يمكن تعديل هذا الخط لاحقًا بعد جلسة تحديد المستوى، وسيُحفظ آخر تحديث في سجل التدقيق."
              : "This can be revised after placement; the latest update remains in the audit trail."}
          </p>
          <AdminSubmitButton
            label={
              baseline
                ? ar
                  ? "تحديث نقطة البداية"
                  : "Update starting point"
                : ar
                  ? "حفظ نقطة البداية"
                  : "Save starting point"
            }
            pendingLabel={ar ? "جارٍ الحفظ…" : "Saving…"}
          />
        </div>
      </div>
    </form>
  );
}

function LocationPicker({
  locale,
  label,
  name,
  value,
  onChange,
  surahs,
  allowEmpty = false,
  disabled = false,
}: {
  locale: AppLocale;
  label: string;
  name: string;
  value: number | "";
  onChange: (value: number | "") => void;
  surahs: QuranLocationOption[];
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  const ar = locale === "ar";
  const selectedSurah = useMemo(
    () =>
      surahs.find((surah) => value !== "" && value >= surah.firstPage && value <= surah.lastPage) ??
      surahs[0],
    [surahs, value],
  );
  const pages = selectedSurah
    ? Array.from(
        { length: selectedSurah.lastPage - selectedSurah.firstPage + 1 },
        (_, index) => selectedSurah.firstPage + index,
      )
    : [];

  return (
    <fieldset className={cn("grid gap-2", disabled && "opacity-55")} disabled={disabled}>
      <legend className="mb-1 text-sm font-bold text-primary">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          {ar ? "السورة" : "Surah"}
          <select
            value={value === "" ? "" : selectedSurah?.id}
            onChange={(event) => {
              if (!event.target.value) return onChange("");
              const surah = surahs.find((item) => item.id === Number(event.target.value));
              onChange(surah?.firstPage ?? "");
            }}
            className="min-h-11 rounded-xl border bg-background px-3 font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allowEmpty ? <option value="">{ar ? "غير محدد" : "Not set"}</option> : null}
            {surahs.map((surah) => (
              <option key={surah.id} value={surah.id}>
                {surah.id}. {ar ? surah.nameAr : surah.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {ar ? "الصفحة" : "Page"}
          <select
            name={name}
            value={value}
            onChange={(event) => onChange(event.target.value ? Number(event.target.value) : "")}
            className="min-h-11 rounded-xl border bg-background px-2 font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allowEmpty ? <option value="">—</option> : null}
            {pages.map((page) => (
              <option key={page} value={page}>
                {new Intl.NumberFormat(locale).format(page)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
