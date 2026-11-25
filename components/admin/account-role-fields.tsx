"use client";

import { Link2, UserRound } from "lucide-react";
import { useState } from "react";

import { Label } from "@/components/ui/label";

type Role = "admin" | "teacher" | "student" | "parent";

export function AccountRoleFields({
  locale,
  roleLabels,
  students,
}: {
  locale: "ar" | "en";
  roleLabels: Record<Role, string>;
  students: Array<{ id: string; full_name: string; student_no: string }>;
}) {
  const [role, setRole] = useState<Role>("student");
  const ar = locale === "ar";

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="role">{ar ? "دور البوابة" : "Portal role"}</Label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(event) => {
            const nextRole = event.target.value as Role;
            setRole(nextRole);
            if (event.currentTarget.form) {
              event.currentTarget.form.dataset.accountRole = nextRole;
            }
          }}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
        >
          <option value="admin">{roleLabels.admin}</option>
          <option value="teacher">{roleLabels.teacher}</option>
          <option value="student">{roleLabels.student}</option>
          <option value="parent">{roleLabels.parent}</option>
        </select>
      </div>

      {role === "parent" ? (
        <section className="grid gap-4 rounded-2xl border border-secondary/30 bg-secondary/5 p-4 sm:col-span-2">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-secondary">
              <Link2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-black text-primary">
                {ar ? "ربط ولي الأمر بالابن" : "Link the parent to a child"}
              </h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {ar
                  ? "اختر الطالب المسجل. سيظهر هذا الطالب مباشرة داخل بوابة ولي الأمر بعد إنشاء الحساب."
                  : "Choose an existing student. The child will appear in the parent portal immediately after account creation."}
              </p>
            </div>
          </div>

          {students.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="parentStudentId">{ar ? "الابن" : "Child"}</Label>
                <select
                  id="parentStudentId"
                  name="parentStudentId"
                  defaultValue=""
                  required
                  className="min-h-11 rounded-xl border bg-card px-3 text-sm"
                >
                  <option value="" disabled>
                    {ar ? "اختر الطالب" : "Choose a student"}
                  </option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name} · {student.student_no}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="parentRelation">{ar ? "صلة القرابة" : "Relationship"}</Label>
                <select
                  id="parentRelation"
                  name="parentRelation"
                  defaultValue="father"
                  className="min-h-11 rounded-xl border bg-card px-3 text-sm"
                >
                  <option value="father">{ar ? "الأب" : "Father"}</option>
                  <option value="mother">{ar ? "الأم" : "Mother"}</option>
                  <option value="guardian">{ar ? "ولي أمر آخر" : "Other guardian"}</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="flex min-h-24 items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <UserRound className="size-5 shrink-0 text-secondary" aria-hidden="true" />
              <span>
                {ar
                  ? "لا يوجد طلاب متاحون للربط. أنشئ حساب الطالب أولًا ثم عُد لإنشاء ولي الأمر."
                  : "No students are available. Create the student account first, then return to create the parent."}
              </span>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
