import "server-only";

import { connection } from "next/server";
import { DateTime } from "luxon";

import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { studentFiltersSchema, type StudentFilters } from "@/lib/validators/students";

const PAGE_SIZE = 20;

export type StudentListItem = {
  id: string;
  studentNo: string;
  fullName: string;
  gender: "male" | "female";
  status: "active" | "dropped" | "graduated" | "suspended" | "archived";
  countryCode: string | null;
  timezone: string;
  birthDate: string | null;
  joinedAt: string;
  levelId: string | null;
  levelName: string | null;
  trackName: string | null;
};

export async function getStudentDirectory(
  raw: Record<string, string | string[] | undefined>,
  locale: AppLocale,
) {
  await connection();
  const parsed = studentFiltersSchema.safeParse({
    q: single(raw.q),
    status: single(raw.status),
    level: single(raw.level),
    country: single(raw.country),
    page: single(raw.page),
  });
  const filters = parsed.success ? parsed.data : studentFiltersSchema.parse({});
  const supabase = await createClient();
  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  let query = supabase
    .from("students")
    .select(
      "id, student_no, full_name, gender, status, country_code, timezone, birth_date, joined_at, level_id, level:levels(name_ar,name_en,track:tracks(name_ar,name_en))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.q) {
    const safe = filters.q.replace(/[,%()]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,student_no.ilike.%${safe}%`);
  }
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.level !== "all") query = query.eq("level_id", filters.level);
  if (filters.country) query = query.eq("country_code", filters.country);

  const [{ data, count, error }, { data: levels }] = await Promise.all([
    query,
    supabase
      .from("levels")
      .select("id,name_ar,name_en,track:tracks(name_ar,name_en)")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  if (error) throw new Error("student_directory_unavailable");

  return {
    filters,
    students: (data ?? []).map((student) => mapStudent(student, locale)),
    levels: (levels ?? []).map((level) => ({
      id: level.id,
      label: locale === "ar" ? level.name_ar : (level.name_en ?? level.name_ar),
      track:
        locale === "ar" ? level.track?.name_ar : (level.track?.name_en ?? level.track?.name_ar),
    })),
    pageCount: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    total: count ?? 0,
    today: DateTime.now().setZone("Africa/Cairo").toFormat("yyyy-LL-dd"),
  };
}

export async function getStudentForEditing(id: string, locale: AppLocale) {
  const supabase = await createClient();
  const [{ data: student, error }, { data: notes, error: notesError }] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("get_student_private_notes", { p_student: id }).maybeSingle(),
  ]);
  if (error || notesError || !student) return null;
  return {
    ...mapStudent(student, locale),
    healthNotes: notes?.health_notes ?? null,
    specialNotes: notes?.special_notes ?? null,
    shareWithTeacher: notes?.share_with_teacher ?? false,
  };
}

export async function getStudentsForExport(filters: StudentFilters, locale: AppLocale) {
  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select(
      "id,student_no,full_name,gender,status,country_code,timezone,birth_date,joined_at,level_id,level:levels(name_ar,name_en,track:tracks(name_ar,name_en))",
    )
    .order("student_no")
    .limit(10_000);
  if (filters.q) {
    const safe = filters.q.replace(/[,%()]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,student_no.ilike.%${safe}%`);
  }
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.level !== "all") query = query.eq("level_id", filters.level);
  if (filters.country) query = query.eq("country_code", filters.country);
  const { data, error } = await query;
  if (error) throw new Error("student_export_unavailable");
  return (data ?? []).map((student) => mapStudent(student, locale));
}

type StudentQueryRow = {
  id: string;
  student_no: string;
  full_name: string;
  gender: "male" | "female";
  status: StudentListItem["status"];
  country_code: string | null;
  timezone: string;
  birth_date: string | null;
  joined_at: string;
  level_id: string | null;
  level?:
    | {
        name_ar: string;
        name_en: string | null;
        track:
          | { name_ar: string; name_en: string | null }
          | { name_ar: string; name_en: string | null }[]
          | null;
      }
    | {
        name_ar: string;
        name_en: string | null;
        track:
          | { name_ar: string; name_en: string | null }
          | { name_ar: string; name_en: string | null }[]
          | null;
      }[]
    | null;
};

function mapStudent(value: unknown, locale: AppLocale): StudentListItem {
  const student = value as StudentQueryRow;
  const level = Array.isArray(student.level) ? student.level[0] : student.level;
  const track = Array.isArray(level?.track) ? level.track[0] : level?.track;
  return {
    id: student.id,
    studentNo: student.student_no,
    fullName: student.full_name,
    gender: student.gender,
    status: student.status,
    countryCode: student.country_code,
    timezone: student.timezone,
    birthDate: student.birth_date,
    joinedAt: student.joined_at,
    levelId: student.level_id,
    levelName: level ? (locale === "ar" ? level.name_ar : (level.name_en ?? level.name_ar)) : null,
    trackName: track ? (locale === "ar" ? track.name_ar : (track.name_en ?? track.name_ar)) : null,
  };
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
