import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 8;

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type TeacherStudentFilters = {
  page?: number;
  q?: string;
  status?: "all" | "active" | "dropped" | "graduated" | "suspended" | "archived";
  followUp?: "all" | "regular" | "needs_follow_up" | "evaluation_pending";
  sort?: "name" | "next_session" | "recent_evaluation";
};

export async function getTeacherStudents(filters: TeacherStudentFilters = {}) {
  await connection();
  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .maybeSingle();
  if (teacherError) throw new Error("teacher_students_unavailable");
  if (!teacher)
    return {
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: PAGE_SIZE,
      summary: { followUp: 0, pending: 0, planned: 0 },
    };

  const { data: assignments, error: assignmentsError } = await supabase
    .from("teacher_assignments")
    .select(
      "student_id,created_at,students!teacher_assignments_student_id_fkey(id,full_name,student_no,status,timezone,level:levels(id,name_ar,name_en,track:tracks(name_ar,name_en)))",
    )
    .eq("teacher_id", teacher.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (assignmentsError) throw new Error("teacher_students_unavailable");

  const query = (filters.q ?? "").trim().toLocaleLowerCase();
  const requestedStatus = filters.status ?? "all";
  const base = (assignments ?? []).filter((assignment) => {
    if (requestedStatus !== "all" && assignment.students.status !== requestedStatus) return false;
    if (!query) return true;
    return `${assignment.students.full_name} ${assignment.students.student_no}`
      .toLocaleLowerCase()
      .includes(query);
  });
  const studentIds = base.map((item) => item.student_id);

  const now = new Date().toISOString();
  const [sessionsResult, plansResult, adherenceResult, reportsResult] = studentIds.length
    ? await Promise.all([
        supabase
          .from("sessions")
          .select(
            "id,student_id,scheduled_at,ends_at,status,attendance(status),evaluation:session_evaluations(total_score,is_locked,updated_at)",
          )
          .in("student_id", studentIds)
          .order("scheduled_at", { ascending: false })
          .limit(Math.max(studentIds.length * 12, 40)),
        supabase
          .from("memorization_plans")
          .select("student_id,weekly_target_pages,monthly_target_pages,starts_on,ends_on")
          .in("student_id", studentIds),
        supabase
          .from("v_memorization_plan_adherence")
          .select("student_id,weekly_adherence_percent,weekly_achieved_pages,weekly_target_pages")
          .in("student_id", studentIds),
        supabase
          .from("reports")
          .select("id,student_id,status,period_end,updated_at")
          .eq("teacher_id", teacher.id)
          .in("student_id", studentIds)
          .order("updated_at", { ascending: false }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (sessionsResult.error || plansResult.error || adherenceResult.error || reportsResult.error) {
    throw new Error("teacher_students_unavailable");
  }

  const plans = new Map((plansResult.data ?? []).map((item) => [item.student_id, item]));
  const adherence = new Map(
    (adherenceResult.data ?? [])
      .filter((item) => item.student_id)
      .map((item) => [item.student_id as string, item]),
  );
  const sessionsByStudent = new Map<string, (typeof sessionsResult.data)[number][]>();
  for (const session of sessionsResult.data ?? []) {
    const list = sessionsByStudent.get(session.student_id) ?? [];
    list.push(session);
    sessionsByStudent.set(session.student_id, list);
  }
  const latestReportByStudent = new Map<string, (typeof reportsResult.data)[number]>();
  for (const report of reportsResult.data ?? []) {
    if (!latestReportByStudent.has(report.student_id))
      latestReportByStudent.set(report.student_id, report);
  }

  let enriched = base.map((assignment) => {
    const sessions = sessionsByStudent.get(assignment.student_id) ?? [];
    const nextSession = sessions
      .filter((session) => session.scheduled_at >= now && session.status === "scheduled")
      .toSorted((left, right) => left.scheduled_at.localeCompare(right.scheduled_at))[0];
    const lastEvaluation = sessions
      .map((session) => ({ session, evaluation: one(session.evaluation) }))
      .find((item) => item.evaluation?.is_locked);
    const pendingEvaluation = sessions.some(
      (session) =>
        session.ends_at < now && one(session.attendance) && !one(session.evaluation)?.is_locked,
    );
    const plan = plans.get(assignment.student_id) ?? null;
    const planAdherence = adherence.get(assignment.student_id) ?? null;
    const adherencePercent = planAdherence?.weekly_adherence_percent ?? null;
    const followUp = pendingEvaluation
      ? "evaluation_pending"
      : plan && Number(adherencePercent ?? 0) < 70
        ? "needs_follow_up"
        : "regular";
    return {
      id: assignment.student_id,
      name: assignment.students.full_name,
      number: assignment.students.student_no,
      status: assignment.students.status,
      timezone: assignment.students.timezone,
      level: assignment.students.level
        ? {
            id: assignment.students.level.id,
            nameAr: assignment.students.level.name_ar,
            nameEn: assignment.students.level.name_en,
          }
        : null,
      track: assignment.students.level?.track
        ? {
            nameAr: assignment.students.level.track.name_ar,
            nameEn: assignment.students.level.track.name_en,
          }
        : null,
      nextSession: nextSession
        ? { id: nextSession.id, scheduledAt: nextSession.scheduled_at }
        : null,
      plan: plan
        ? {
            weeklyTarget: plan.weekly_target_pages,
            weeklyAchieved: planAdherence?.weekly_achieved_pages ?? 0,
            adherencePercent,
          }
        : null,
      lastEvaluation: lastEvaluation?.evaluation
        ? {
            score: lastEvaluation.evaluation.total_score,
            at: lastEvaluation.session.scheduled_at,
          }
        : null,
      latestReport: latestReportByStudent.get(assignment.student_id) ?? null,
      followUp,
    } as const;
  });

  const summary = {
    followUp: enriched.filter((item) => item.followUp === "needs_follow_up").length,
    pending: enriched.filter((item) => item.followUp === "evaluation_pending").length,
    planned: enriched.filter((item) => item.plan).length,
  };
  if (filters.followUp && filters.followUp !== "all") {
    enriched = enriched.filter((item) => item.followUp === filters.followUp);
  }
  enriched.sort((left, right) => {
    if (filters.sort === "next_session") {
      return (left.nextSession?.scheduledAt ?? "9999").localeCompare(
        right.nextSession?.scheduledAt ?? "9999",
      );
    }
    if (filters.sort === "recent_evaluation") {
      return (right.lastEvaluation?.at ?? "").localeCompare(left.lastEvaluation?.at ?? "");
    }
    return left.name.localeCompare(right.name);
  });

  const total = enriched.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const start = (page - 1) * PAGE_SIZE;
  return {
    items: enriched.slice(start, start + PAGE_SIZE),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    summary,
  };
}

export async function getTeacherStudent360(studentId: string) {
  await connection();
  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id,profile:profiles(full_name)")
    .maybeSingle();
  if (teacherError) throw new Error("teacher_student_unavailable");
  if (!teacher) return null;

  const { data: assignment, error: assignmentError } = await supabase
    .from("teacher_assignments")
    .select(
      "student_id,students!teacher_assignments_student_id_fkey(id,full_name,student_no,status,timezone,joined_at,level:levels(id,name_ar,name_en,track:tracks(name_ar,name_en)))",
    )
    .eq("teacher_id", teacher.id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (assignmentError) throw new Error("teacher_student_unavailable");
  if (!assignment) return null;

  const [
    sessionsResult,
    planResult,
    adherenceResult,
    progressResult,
    reportsResult,
    teacherNotesResult,
    sharedNotesResult,
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id,scheduled_at,ends_at,duration_min,status,kind,attendance(status,minutes,recorded_at),evaluation:session_evaluations(id,session_type,total_score,rating,family_note,decision,is_locked,locked_at,weak_tags,homework,updated_at,from_ayah:quran_ayahs!session_evaluations_from_ayah_id_fkey(page,surah:quran_surahs(name_ar,name_en)),to_ayah:quran_ayahs!session_evaluations_to_ayah_id_fkey(page,surah:quran_surahs(name_ar,name_en)))",
      )
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .order("scheduled_at", { ascending: false })
      .limit(60),
    supabase
      .from("memorization_plans")
      .select("id,weekly_target_pages,monthly_target_pages,starts_on,ends_on,updated_at")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("v_memorization_plan_adherence")
      .select(
        "weekly_target_pages,monthly_target_pages,weekly_achieved_pages,monthly_achieved_pages,weekly_adherence_percent,monthly_adherence_percent,starts_on,ends_on",
      )
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("memorization_progress")
      .select("page,status,avg_score,last_reviewed_at,next_review_due,review_count,updated_at")
      .eq("student_id", studentId)
      .order("page"),
    supabase
      .from("reports")
      .select(
        "id,period_type,period_start,period_end,status,approved_at,made_visible_at,updated_at",
      )
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .order("period_start", { ascending: false }),
    supabase
      .from("teacher_student_notes")
      .select("id,body,created_at,updated_at")
      .eq("teacher_id", teacher.id)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_shared_student_notes", { p_student: studentId }).maybeSingle(),
  ]);
  if (
    sessionsResult.error ||
    planResult.error ||
    adherenceResult.error ||
    progressResult.error ||
    reportsResult.error ||
    teacherNotesResult.error ||
    sharedNotesResult.error
  ) {
    throw new Error("teacher_student_unavailable");
  }

  const sessions = (sessionsResult.data ?? []).map((session) => ({
    ...session,
    attendance: one(session.attendance),
    evaluation: one(session.evaluation),
  }));
  const now = new Date().toISOString();
  const nextSession =
    sessions
      .filter((session) => session.scheduled_at >= now && session.status === "scheduled")
      .toSorted((left, right) => left.scheduled_at.localeCompare(right.scheduled_at))[0] ?? null;
  const lockedEvaluations = sessions.filter((session) => session.evaluation?.is_locked);
  const progress = progressResult.data ?? [];
  const today = DateTime.now().setZone(assignment.students.timezone).toISODate() ?? "";
  const reviewPages = progress.filter(
    (item) =>
      item.status === "needs_review" ||
      (item.next_review_due !== null && item.next_review_due <= today),
  );

  return {
    teacher: { id: teacher.id, name: one(teacher.profile)?.full_name ?? "" },
    student: {
      id: assignment.students.id,
      name: assignment.students.full_name,
      number: assignment.students.student_no,
      status: assignment.students.status,
      timezone: assignment.students.timezone,
      joinedAt: assignment.students.joined_at,
      level: assignment.students.level
        ? { nameAr: assignment.students.level.name_ar, nameEn: assignment.students.level.name_en }
        : null,
      track: assignment.students.level?.track
        ? {
            nameAr: assignment.students.level.track.name_ar,
            nameEn: assignment.students.level.track.name_en,
          }
        : null,
    },
    sessions,
    nextSession,
    plan: planResult.data,
    adherence: adherenceResult.data,
    progress,
    masteredPages: progress.filter((item) => item.status === "mastered").length,
    reviewPages,
    latestEvaluation: lockedEvaluations[0] ?? null,
    reports: reportsResult.data ?? [],
    teacherNotes: teacherNotesResult.data ?? [],
    sharedNotes: sharedNotesResult.data,
    publishedNotes: lockedEvaluations
      .filter((session) => session.evaluation?.family_note?.trim())
      .map((session) => ({
        id: session.evaluation!.id,
        date: session.scheduled_at,
        note: session.evaluation!.family_note!,
      })),
  };
}

export type TeacherStudent360Data = NonNullable<Awaited<ReturnType<typeof getTeacherStudent360>>>;
