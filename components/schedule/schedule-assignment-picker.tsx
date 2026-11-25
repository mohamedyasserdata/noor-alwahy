"use client";

import { useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";

type AssignmentOption = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
};

export function ScheduleAssignmentPicker({
  assignments,
  locale,
}: {
  assignments: AssignmentOption[];
  locale: AppLocale;
}) {
  const students = useMemo(
    () =>
      [...new Map(assignments.map((item) => [item.studentId, item.studentName])).entries()].map(
        ([id, name]) => ({ id, name }),
      ),
    [assignments],
  );
  const initialStudentId = students.length === 1 ? (students[0]?.id ?? "") : "";
  const initialAssignments = assignments.filter((item) => item.studentId === initialStudentId);
  const [studentId, setStudentId] = useState(initialStudentId);
  const [assignmentId, setAssignmentId] = useState(
    initialAssignments.length === 1 ? (initialAssignments[0]?.id ?? "") : "",
  );
  const teacherAssignments = assignments.filter((item) => item.studentId === studentId);
  const ar = locale === "ar";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="schedule-student">{ar ? "الطالب" : "Student"}</Label>
        <select
          id="schedule-student"
          value={studentId}
          onChange={(event) => {
            const nextStudentId = event.target.value;
            const nextAssignments = assignments.filter((item) => item.studentId === nextStudentId);
            setStudentId(nextStudentId);
            setAssignmentId(nextAssignments.length === 1 ? (nextAssignments[0]?.id ?? "") : "");
          }}
          required
          className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3"
        >
          <option value="">{ar ? "اختر الطالب" : "Choose student"}</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="schedule-assignment">{ar ? "المدرس" : "Teacher"}</Label>
        <select
          id="schedule-assignment"
          name="assignmentId"
          value={assignmentId}
          onChange={(event) => setAssignmentId(event.target.value)}
          required
          disabled={!studentId}
          className="min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <option value="">
            {studentId
              ? ar
                ? "اختر المدرس"
                : "Choose teacher"
              : ar
                ? "اختر الطالب أولًا"
                : "Choose the student first"}
          </option>
          {teacherAssignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.teacherName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
