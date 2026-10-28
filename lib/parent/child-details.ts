import "server-only";

import { DateTime } from "luxon";
import { connection } from "next/server";

import { summarizeStudentAttendance } from "@/lib/attendance/student-rate";
import { getGuardianPortalContext } from "@/lib/parent/children";
import { createClient } from "@/lib/supabase/server";

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function textField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field : null;
}

export async function getGuardianChildDetails(studentId: string) {
  await connection();
  const context = await getGuardianPortalContext();
  const child = context.children.find((item) => item.id === studentId);
  if (!child) throw new Error("guardian_child_not_found");

  const supabase = await createClient();
  const now = DateTime.utc();
  const attendanceFrom = now.minus({ days: 30 }).toISO();
  const scheduleFrom = now.minus({ days: 90 }).toISO();

  const [sessionsResult, reportsResult, progressResult] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id,scheduled_at,ends_at,status,duration_min,teacher:teachers!sessions_teacher_id_fkey(profile:profiles!teachers_profile_id_fkey(full_name)),attendance(status,minutes,recorded_at),evaluation:session_evaluations(total_score,family_note,is_locked,locked_at)",
      )
      .eq("student_id", studentId)
      .gte("scheduled_at", scheduleFrom)
      .order("scheduled_at", { ascending: false })
      .limit(80),
    supabase
      .from("reports")
      .select("id,period_type,period_start,period_end,body,made_visible_at,pdf_path")
      .eq("student_id", studentId)
      .eq("status", "visible")
      .order("made_visible_at", { ascending: false })
      .limit(12),
    supabase.from("memorization_progress").select("status,updated_at").eq("student_id", studentId),
  ]);
  if (sessionsResult.error || reportsResult.error || progressResult.error) {
    throw new Error("guardian_child_details_unavailable");
  }

  const sessions = sessionsResult.data ?? [];
  const attendanceRows = sessions
    .filter((session) => session.scheduled_at >= attendanceFrom)
    .flatMap((session) => {
      const attendance = relation(session.attendance);
      return attendance ? [{ session, attendance }] : [];
    });
  const attendanceSummary = summarizeStudentAttendance(
    attendanceRows.map(({ attendance }) => attendance.status),
  );
  const upcomingRows = sessions
    .filter((session) => DateTime.fromISO(session.ends_at) >= now)
    .toSorted((left, right) => left.scheduled_at.localeCompare(right.scheduled_at))
    .slice(0, 8);
  const pastRows = sessions
    .filter((session) => DateTime.fromISO(session.ends_at) < now)
    .slice(0, 8);
  const joins = await Promise.all(
    upcomingRows.map(async (session) => {
      const { data } = await supabase.rpc("get_session_join", { p_session_id: session.id });
      const join = data?.[0];
      return [
        session.id,
        {
          joinUrl: join?.join_url ?? null,
          meetingId: join?.meeting_id ?? null,
          passcode: join?.passcode ?? null,
        },
      ] as const;
    }),
  );
  const joinBySession = new Map(joins);

  const mapSession = (session: (typeof sessions)[number]) => {
    const teacher = relation(session.teacher);
    const profile = teacher ? relation(teacher.profile) : null;
    const attendance = relation(session.attendance);
    return {
      id: session.id,
      scheduledAt: session.scheduled_at,
      endsAt: session.ends_at,
      status: session.status,
      durationMinutes: session.duration_min,
      teacherName: profile?.full_name ?? child.teacherName,
      attendanceStatus: attendance?.status ?? null,
      joinUrl: joinBySession.get(session.id)?.joinUrl ?? null,
      meetingId: joinBySession.get(session.id)?.meetingId ?? null,
      passcode: joinBySession.get(session.id)?.passcode ?? null,
    };
  };

  const lockedEvaluations = sessions
    .flatMap((session) => {
      const evaluation = relation(session.evaluation);
      return evaluation?.is_locked ? [{ session, evaluation }] : [];
    })
    .toSorted((left, right) => right.session.scheduled_at.localeCompare(left.session.scheduled_at));
  const latestEvaluation = lockedEvaluations[0];
  const latestFamilyNote = lockedEvaluations.find(({ evaluation }) => evaluation.family_note);
  const progressRows = progressResult.data ?? [];
  const latestProgressUpdate =
    progressRows
      .map((row) => row.updated_at)
      .toSorted((left, right) => right.localeCompare(left))[0] ?? null;

  return {
    child,
    attendance: {
      periodDays: 30,
      ...attendanceSummary,
      records: attendanceRows.slice(0, 16).map(({ session, attendance }) => ({
        id: session.id,
        scheduledAt: session.scheduled_at,
        status: attendance.status,
        minutes: attendance.minutes,
      })),
    },
    progress: {
      mastered: progressRows.filter((row) => row.status === "mastered").length,
      inProgress: progressRows.filter((row) => row.status === "in_progress").length,
      needsReview: progressRows.filter((row) => row.status === "needs_review").length,
      lastUpdatedAt: latestProgressUpdate,
    },
    latestEvaluation: latestEvaluation
      ? {
          score: latestEvaluation.evaluation.total_score,
          lockedAt: latestEvaluation.evaluation.locked_at,
          sessionAt: latestEvaluation.session.scheduled_at,
        }
      : null,
    familyNote: latestFamilyNote
      ? {
          text: latestFamilyNote.evaluation.family_note!,
          teacherName: mapSession(latestFamilyNote.session).teacherName,
          sessionAt: latestFamilyNote.session.scheduled_at,
        }
      : null,
    reports: (reportsResult.data ?? []).map((report) => ({
      ...report,
      summary: textField(report.body, "summary"),
      recommendation: textField(report.body, "recommendation"),
    })),
    schedule: {
      upcoming: upcomingRows.map(mapSession),
      past: pastRows.map(mapSession),
    },
  };
}
