import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import { summarizeStudentAttendance } from "@/lib/attendance/student-rate";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/validators/attendance";

const criteria = [
  "memorization",
  "tajweed_applied",
  "makharij",
  "waqf_ibtida",
  "fluency",
  "linking_mutashabihat",
  "commitment",
] as const;

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getStudentProgressDashboard(requestedStudentId?: string) {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("progress_auth_required");

  const studentQuery = supabase.from("students").select("id,full_name,timezone");
  const { data: student, error: studentError } = requestedStudentId
    ? await studentQuery.eq("id", requestedStudentId).single()
    : await studentQuery.eq("profile_id", auth.user.id).single();
  if (studentError) throw new Error("progress_student_unavailable");

  const now = DateTime.now().setZone(student.timezone);
  const currentStart = now.startOf("month");
  const previousStart = currentStart.minus({ months: 1 });
  const [progressResult, pagesResult, sessionsResult, reportsResult] = await Promise.all([
    supabase
      .from("memorization_progress")
      .select("page,status,first_memorized_at,next_review_due")
      .eq("student_id", student.id),
    supabase.from("quran_pages").select("page,juz"),
    supabase
      .from("sessions")
      .select(
        "id,scheduled_at,status,attendance(status),evaluation:session_evaluations(total_score,scores,homework,is_locked)",
      )
      .eq("student_id", student.id)
      .gte("scheduled_at", previousStart.toUTC().toISO())
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("reports")
      .select("id,period_type,period_start,period_end,body,made_visible_at")
      .eq("student_id", student.id)
      .eq("status", "visible")
      .order("made_visible_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (progressResult.error || pagesResult.error || sessionsResult.error || reportsResult.error) {
    throw new Error("progress_dashboard_unavailable");
  }

  const progress = progressResult.data ?? [];
  const mastered = progress.filter((row) => row.status === "mastered");
  const pageJuz = new Map((pagesResult.data ?? []).map((page) => [page.page, page.juz]));
  const masteredByJuz = new Map<number, number>();
  const totalByJuz = new Map<number, number>();
  for (const page of pagesResult.data ?? [])
    totalByJuz.set(page.juz, (totalByJuz.get(page.juz) ?? 0) + 1);
  for (const row of mastered) {
    const juz = pageJuz.get(row.page);
    if (juz) masteredByJuz.set(juz, (masteredByJuz.get(juz) ?? 0) + 1);
  }
  const completedJuz = [...totalByJuz]
    .filter(([juz, total]) => masteredByJuz.get(juz) === total)
    .map(([juz]) => juz);
  const fourWeeksAgo = now.minus({ weeks: 4 }).toUTC();
  const recentMastered = mastered.filter(
    (row) => row.first_memorized_at && DateTime.fromISO(row.first_memorized_at) >= fourWeeksAgo,
  ).length;
  const weeklySpeed = Math.round((recentMastered / 4) * 100) / 100;
  const remaining = Math.max(0, 604 - mastered.length);
  const expectedCompletion =
    weeklySpeed > 0 ? now.plus({ weeks: remaining / weeklySpeed }).toISODate() : null;

  const radar = { current: emptyCriteria(), previous: emptyCriteria() };
  const radarCounts = { current: emptyCriteria(), previous: emptyCriteria() };
  const history: Array<{
    id: string;
    date: string;
    score: number | null;
    homework: string | null;
  }> = [];
  const attendanceStatuses: AttendanceStatus[] = [];
  for (const session of sessionsResult.data ?? []) {
    const when = DateTime.fromISO(session.scheduled_at).setZone(student.timezone);
    const evaluation = relation(session.evaluation);
    const attendance = relation(session.attendance);
    if (attendance) attendanceStatuses.push(attendance.status);
    if (!evaluation?.is_locked) continue;
    const bucket = when >= currentStart ? "current" : "previous";
    const scores =
      evaluation.scores &&
      typeof evaluation.scores === "object" &&
      !Array.isArray(evaluation.scores)
        ? evaluation.scores
        : {};
    for (const key of criteria) {
      const value = scores[key];
      if (typeof value === "number") {
        radar[bucket][key] += value * 20;
        radarCounts[bucket][key] += 1;
      }
    }
    const homework =
      evaluation.homework &&
      typeof evaluation.homework === "object" &&
      !Array.isArray(evaluation.homework) &&
      typeof evaluation.homework.text === "string"
        ? evaluation.homework.text
        : null;
    history.push({
      id: session.id,
      date: when.toISODate() ?? "",
      score: evaluation.total_score,
      homework,
    });
  }
  for (const bucket of ["current", "previous"] as const) {
    for (const key of criteria)
      radar[bucket][key] = radarCounts[bucket][key]
        ? Math.round((radar[bucket][key] / radarCounts[bucket][key]) * 100) / 100
        : 0;
  }

  const curve = Array.from({ length: 12 }, (_, index) => {
    const weekStart = now.startOf("week").minus({ weeks: 11 - index });
    const weekEnd = weekStart.endOf("week");
    return {
      label: weekStart.toFormat("dd/LL"),
      value: mastered.filter(
        (row) =>
          row.first_memorized_at &&
          DateTime.fromISO(row.first_memorized_at).setZone(student.timezone) <= weekEnd,
      ).length,
    };
  });
  const today = now.toISODate() ?? "";
  const due = progress.filter((row) => row.next_review_due && row.next_review_due <= today);
  const attendance = summarizeStudentAttendance(attendanceStatuses);

  return {
    student: { id: student.id, name: student.full_name },
    metrics: {
      masteredPages: mastered.length,
      completedJuz: completedJuz.length,
      percent: Math.round((mastered.length / 604) * 10000) / 100,
      weeklySpeed,
      expectedCompletion,
      attendanceRate: attendance.rate,
      updatedAt: now.toISO() ?? new Date().toISOString(),
    },
    radar,
    curve,
    history: history.slice(0, 12),
    review: { due: due.length, overdue: due.filter((row) => row.next_review_due! < today).length },
    homework: history.find((item) => item.homework)?.homework ?? null,
    latestReport: reportsResult.data,
    badges: { completedJuz, weeklyConsistency: recentMastered > 0 },
  };
}

function emptyCriteria(): Record<(typeof criteria)[number], number> {
  return {
    memorization: 0,
    tajweed_applied: 0,
    makharij: 0,
    waqf_ibtida: 0,
    fluency: 0,
    linking_mutashabihat: 0,
    commitment: 0,
  };
}
