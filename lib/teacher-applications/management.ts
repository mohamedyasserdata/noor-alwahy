import "server-only";

import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { teacherApplicationQuerySchema } from "@/lib/validators/teacher-applications";

export async function getTeacherApplications(
  locale: AppLocale,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
) {
  await requireRole("admin", locale);
  const raw = await searchParams;
  const parsed = teacherApplicationQuerySchema.parse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
  });
  const supabase = await createClient();
  let request = supabase
    .from("teacher_applications")
    .select(
      "id,application_no,status,full_name,email,phone,gender,specialization,qualifications,experience_years,teaching_languages,availability,cv_path,cv_name,internal_notes,invited_user_id,created_at,reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (parsed.status !== "all") request = request.eq("status", parsed.status);
  if (parsed.q) {
    const query = parsed.q
      .replace(/[,%()_]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (query) {
      request = request.or(
        `full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,application_no.ilike.%${query}%`,
      );
    }
  }

  const { data, error } = await request;
  if (error) throw new Error("teacher_applications_unavailable");
  return { applications: data ?? [], filters: parsed };
}
