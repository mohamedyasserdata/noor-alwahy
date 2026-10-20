import "server-only";

import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ProgressRow = Pick<
  Database["public"]["Tables"]["memorization_progress"]["Row"],
  "page" | "status" | "first_memorized_at" | "last_reviewed_at" | "avg_score" | "review_count"
>;

export type QuranMapPage = {
  page: number;
  juz: number;
  firstAyahId: number;
  lastAyahId: number;
  firstSurahId: number;
  lastSurahId: number;
};

export type QuranMapSurah = Pick<
  Database["public"]["Tables"]["quran_surahs"]["Row"],
  "id" | "name_ar" | "name_en" | "ayah_count"
>;

export type QuranMapProgress = ProgressRow;

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getStudentQuranMap() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("quran_map_auth_required");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,full_name")
    .eq("profile_id", user.id)
    .single();
  if (studentError) throw new Error("quran_map_student_unavailable");

  const [pagesResult, surahsResult, progressResult] = await Promise.all([
    supabase
      .from("quran_pages")
      .select(
        "page,juz,first_ayah_id,last_ayah_id,first_ayah:quran_ayahs!quran_pages_first_ayah_id_fkey(surah_id),last_ayah:quran_ayahs!quran_pages_last_ayah_id_fkey(surah_id)",
      )
      .order("page"),
    supabase.from("quran_surahs").select("id,name_ar,name_en,ayah_count").order("id"),
    supabase
      .from("memorization_progress")
      .select("page,status,first_memorized_at,last_reviewed_at,avg_score,review_count")
      .eq("student_id", student.id)
      .order("page"),
  ]);

  if (pagesResult.error || surahsResult.error || progressResult.error) {
    throw new Error("quran_map_unavailable");
  }

  const pages = (pagesResult.data ?? []).map((page) => {
    const firstAyah = one(page.first_ayah);
    const lastAyah = one(page.last_ayah);
    if (!firstAyah || !lastAyah) throw new Error("quran_map_page_metadata_missing");
    return {
      page: page.page,
      juz: page.juz,
      firstAyahId: page.first_ayah_id,
      lastAyahId: page.last_ayah_id,
      firstSurahId: firstAyah.surah_id,
      lastSurahId: lastAyah.surah_id,
    } satisfies QuranMapPage;
  });
  if (pages.length !== 604 || surahsResult.data?.length !== 114) {
    throw new Error("quran_map_dataset_incomplete");
  }

  return {
    studentId: student.id,
    studentName: student.full_name,
    pages,
    surahs: surahsResult.data ?? [],
    progress: progressResult.data ?? [],
  };
}
