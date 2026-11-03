import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { calculateProgressSummary } from "./overview-calculations";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getStudentProgressOverview() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("student_progress_auth_required");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,full_name,timezone")
    .eq("profile_id", user.id)
    .single();
  if (studentError) throw new Error("student_progress_student_unavailable");

  const [progressResult, pagesResult, surahsResult, sessionsResult] = await Promise.all([
    supabase
      .from("memorization_progress")
      .select(
        "page,status,avg_score,first_memorized_at,last_reviewed_at,next_review_due,review_count,updated_at",
      )
      .eq("student_id", student.id),
    supabase
      .from("quran_pages")
      .select(
        "page,juz,first_ayah:quran_ayahs!quran_pages_first_ayah_id_fkey(surah_id),last_ayah:quran_ayahs!quran_pages_last_ayah_id_fkey(surah_id)",
      )
      .order("page"),
    supabase.from("quran_surahs").select("id,name_ar,name_en").order("id"),
    supabase
      .from("sessions")
      .select(
        "id,scheduled_at,evaluation:session_evaluations(id,session_type,total_score,family_note,is_locked,from_ayah_id,to_ayah_id,from_ayah:quran_ayahs!session_evaluations_from_ayah_id_fkey(page,surah_id),to_ayah:quran_ayahs!session_evaluations_to_ayah_id_fkey(page,surah_id))",
      )
      .eq("student_id", student.id)
      .order("scheduled_at", { ascending: false })
      .limit(100),
  ]);

  if (progressResult.error || pagesResult.error || surahsResult.error || sessionsResult.error) {
    throw new Error("student_progress_overview_unavailable");
  }

  const progress = progressResult.data ?? [];
  const pages = (pagesResult.data ?? []).map((page) => ({
    page: page.page,
    juz: page.juz,
    firstSurahId: one(page.first_ayah)?.surah_id ?? 1,
    lastSurahId: one(page.last_ayah)?.surah_id ?? 1,
  }));
  const surahs = surahsResult.data ?? [];
  const surahById = new Map(surahs.map((surah) => [surah.id, surah]));
  const pageByNumber = new Map(pages.map((page) => [page.page, page]));
  const summary = calculateProgressSummary(pages, progress);

  const history = (sessionsResult.data ?? []).flatMap((session) => {
    const evaluation = one(session.evaluation);
    if (!evaluation?.is_locked) return [];
    const from = one(evaluation.from_ayah);
    const to = one(evaluation.to_ayah);
    const firstSurah = from ? surahById.get(from.surah_id) : null;
    const lastSurah = to ? surahById.get(to.surah_id) : null;
    return [
      {
        id: evaluation.id,
        date: session.scheduled_at,
        sessionType: evaluation.session_type,
        score: evaluation.total_score,
        note: evaluation.family_note,
        fromPage: from?.page ?? null,
        toPage: to?.page ?? null,
        firstSurahAr: firstSurah?.name_ar ?? null,
        firstSurahEn: firstSurah?.name_en ?? null,
        lastSurahAr: lastSurah?.name_ar ?? null,
        lastSurahEn: lastSurah?.name_en ?? null,
      },
    ];
  });

  const today = DateTime.now().setZone(student.timezone).toISODate() ?? "";
  const reviewPages = progress
    .filter(
      (row) =>
        row.status === "needs_review" ||
        (row.next_review_due !== null && row.next_review_due <= today),
    )
    .toSorted((a, b) => {
      if (a.next_review_due && b.next_review_due)
        return a.next_review_due.localeCompare(b.next_review_due);
      return a.page - b.page;
    })
    .map((row) => {
      const page = pageByNumber.get(row.page);
      const surah = page ? surahById.get(page.firstSurahId) : null;
      return {
        page: row.page,
        status: row.status,
        dueAt: row.next_review_due,
        surahAr: surah?.name_ar ?? null,
        surahEn: surah?.name_en ?? null,
      };
    });

  return {
    student: { id: student.id, name: student.full_name },
    currentJuz: summary.currentJuz,
    overall: summary.overall,
    history,
    reviewPages,
    latestTeacherNote: history.find((item) => item.note?.trim())?.note ?? null,
  };
}

export type StudentProgressOverviewData = Awaited<ReturnType<typeof getStudentProgressOverview>>;
