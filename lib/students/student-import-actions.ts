"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { readStudentWorkbook } from "@/lib/students/xlsx-reader";
import {
  validateStudentImportRows,
  type StudentImportError,
} from "@/lib/validators/student-import";

export type StudentImportState = {
  batchId?: string;
  errors: StudentImportError[];
  fileError?: string;
  preview: Array<{
    row: number;
    fullName: string;
    gender: string;
    joinedAt: string;
    levelId: string | null;
    hasPrivateNotes: boolean;
  }>;
};

const emptyStudentImportState: StudentImportState = { errors: [], preview: [] };

function parseLocale(value: string): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

export async function previewStudentImportAction(
  localeValue: string,
  _previous: StudentImportState,
  formData: FormData,
): Promise<StudentImportState> {
  const locale = parseLocale(localeValue);
  const { user } = await requireRole("admin", locale);
  const file = formData.get("workbook");
  if (!(file instanceof File)) return { ...emptyStudentImportState, fileError: "invalid_file" };

  let rows: string[][];
  try {
    rows = await readStudentWorkbook(file);
  } catch (error) {
    return {
      ...emptyStudentImportState,
      fileError: error instanceof Error ? error.message : "invalid_file",
    };
  }

  const supabase = await createClient();
  const [{ data: levels, error: levelsError }, { data: students, error: studentsError }] =
    await Promise.all([
      supabase.from("levels").select("id,name_ar,name_en,track:tracks(code)").eq("is_active", true),
      supabase.from("students").select("full_name,birth_date"),
    ]);
  if (levelsError || studentsError)
    return { ...emptyStudentImportState, fileError: "request_failed" };
  const result = validateStudentImportRows(
    rows,
    (levels ?? []).map((level) => ({
      id: level.id,
      nameAr: level.name_ar,
      nameEn: level.name_en,
      trackCode: Array.isArray(level.track)
        ? (level.track[0]?.code ?? "")
        : (level.track?.code ?? ""),
    })),
    (students ?? []).map((student) => ({
      fullName: student.full_name,
      birthDate: student.birth_date,
    })),
  );
  if (result.errors.length) return { errors: result.errors, preview: [] };

  const { data: batch, error: batchError } = await supabase
    .from("student_import_batches")
    .insert({
      created_by: user.id,
      payload: result.payload,
      row_count: result.payload.length,
      source_name: file.name.slice(0, 180),
    })
    .select("id")
    .single();
  if (batchError || !batch) return { ...emptyStudentImportState, fileError: "request_failed" };

  return {
    batchId: batch.id,
    errors: [],
    preview: result.payload.map((student, index) => ({
      row: index + 2,
      fullName: String(student.full_name),
      gender: String(student.gender),
      joinedAt: String(student.joined_at),
      levelId: student.level_id ? String(student.level_id) : null,
      hasPrivateNotes: Boolean(student.health_notes || student.special_notes),
    })),
  };
}

export async function confirmStudentImportAction(
  localeValue: string,
  formData: FormData,
): Promise<never> {
  const locale = parseLocale(localeValue);
  await requireRole("admin", locale);
  const parsed = z.uuid().safeParse(formData.get("batchId"));
  if (!parsed.success) redirect(`/${locale}/admin/students?importError=invalid_batch` as Route);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_student_import", { p_batch_id: parsed.data });
  if (error) {
    const code = error.message.includes("duplicate_student")
      ? "duplicate_student"
      : "request_failed";
    redirect(`/${locale}/admin/students?importError=${code}` as Route);
  }
  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/audit`);
  redirect(`/${locale}/admin/students?importStatus=confirmed&count=${data}` as Route);
}
