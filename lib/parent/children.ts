import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const getGuardianPortalContext = cache(async () => {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("guardian_auth_required");

  const [profileResult, guardianResult] = await Promise.all([
    supabase.from("profiles").select("full_name,timezone").eq("id", auth.user.id).single(),
    supabase.from("guardians").select("id").eq("profile_id", auth.user.id).maybeSingle(),
  ]);
  if (profileResult.error || guardianResult.error) throw new Error("guardian_unavailable");
  if (!guardianResult.data) {
    return {
      guardianName: profileResult.data.full_name,
      timezone: profileResult.data.timezone,
      children: [],
    };
  }

  const { data: links, error: linksError } = await supabase
    .from("student_guardians")
    .select(
      "student_id,is_primary,students!student_guardians_student_id_fkey(id,full_name,status,timezone,level:levels(name_ar,name_en,track:tracks(name_ar,name_en)))",
    )
    .eq("guardian_id", guardianResult.data.id)
    .order("is_primary", { ascending: false });
  if (linksError) throw new Error("guardian_children_unavailable");

  const studentIds = (links ?? []).map((link) => link.student_id);
  const [assignmentsResult, progressResult, scheduleResult] = studentIds.length
    ? await Promise.all([
        supabase
          .from("teacher_assignments")
          .select(
            "student_id,track:tracks(name_ar,name_en),teacher:teachers(profile:profiles(full_name))",
          )
          .in("student_id", studentIds)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("memorization_progress")
          .select("student_id,status")
          .in("student_id", studentIds),
        supabase.rpc("get_visible_schedule"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (assignmentsResult.error || progressResult.error || scheduleResult.error) {
    throw new Error("guardian_children_summary_unavailable");
  }

  const assignments = assignmentsResult.data ?? [];
  const assignmentByStudent = new Map<string, (typeof assignments)[number]>();
  for (const assignment of assignments) {
    if (!assignmentByStudent.has(assignment.student_id)) {
      assignmentByStudent.set(assignment.student_id, assignment);
    }
  }
  const scheduleByStudentName = new Map(
    (scheduleResult.data ?? []).map((slot) => [slot.student_name, slot]),
  );
  const childNameCounts = new Map<string, number>();
  for (const link of links ?? []) {
    const student = relation(link.students);
    if (student)
      childNameCounts.set(student.full_name, (childNameCounts.get(student.full_name) ?? 0) + 1);
  }

  return {
    guardianName: profileResult.data.full_name,
    timezone: profileResult.data.timezone,
    children: (links ?? []).flatMap((link) => {
      const student = relation(link.students);
      if (!student) return [];
      const level = relation(student.level);
      const levelTrack = level ? relation(level.track) : null;
      const assignment = assignmentByStudent.get(student.id);
      const assignmentTrack = assignment ? relation(assignment.track) : null;
      const teacher = assignment ? relation(assignment.teacher) : null;
      const teacherProfile = teacher ? relation(teacher.profile) : null;
      const schedule =
        childNameCounts.get(student.full_name) === 1
          ? scheduleByStudentName.get(student.full_name)
          : undefined;
      const tracked = (progressResult.data ?? []).filter((row) => row.student_id === student.id);
      const masteredPages = tracked.filter((row) => row.status === "mastered").length;

      return [
        {
          id: student.id,
          name: student.full_name,
          primary: link.is_primary,
          status: student.status,
          timezone: student.timezone,
          levelAr: level?.name_ar ?? null,
          levelEn: level?.name_en ?? level?.name_ar ?? null,
          trackAr:
            assignmentTrack?.name_ar ?? schedule?.track_name_ar ?? levelTrack?.name_ar ?? null,
          trackEn:
            assignmentTrack?.name_en ??
            assignmentTrack?.name_ar ??
            schedule?.track_name_en ??
            schedule?.track_name_ar ??
            levelTrack?.name_en ??
            levelTrack?.name_ar ??
            null,
          teacherName: teacherProfile?.full_name ?? schedule?.teacher_name ?? null,
          masteredPages,
          progressPercent: tracked.length ? Math.round((masteredPages / 604) * 10000) / 100 : null,
        },
      ];
    }),
  };
});

export async function getGuardianChildren() {
  const context = await getGuardianPortalContext();
  return context.children;
}
