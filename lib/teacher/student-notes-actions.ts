"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routing, type AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const noteSchema = z.object({
  studentId: z.uuid(),
  body: z.string().trim().min(2).max(2000),
});

export async function saveTeacherStudentNoteAction(localeValue: string, formData: FormData) {
  const locale = routing.locales.includes(localeValue as AppLocale)
    ? (localeValue as AppLocale)
    : routing.defaultLocale;
  const { user } = await requireRole("teacher", locale);
  const parsed = noteSchema.safeParse({
    studentId: formData.get("studentId"),
    body: formData.get("body"),
  });
  if (!parsed.success) go(locale, String(formData.get("studentId") ?? ""), "error");

  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .single();
  if (teacherError) go(locale, parsed.data.studentId, "error");

  const { error } = await supabase.from("teacher_student_notes").insert({
    student_id: parsed.data.studentId,
    teacher_id: teacher.id,
    body: parsed.data.body,
    created_by: user.id,
  });
  if (error) go(locale, parsed.data.studentId, "error");

  revalidatePath(`/${locale}/teacher/students/${parsed.data.studentId}`);
  go(locale, parsed.data.studentId, "saved");
}

function go(locale: AppLocale, studentId: string, status: "saved" | "error"): never {
  const safeStudentId = z.uuid().safeParse(studentId).success ? studentId : "";
  const target = safeStudentId
    ? `/${locale}/teacher/students/${safeStudentId}`
    : `/${locale}/teacher/students`;
  redirect(`${target}?${new URLSearchParams({ tab: "notes", noteStatus: status })}` as Route);
}
