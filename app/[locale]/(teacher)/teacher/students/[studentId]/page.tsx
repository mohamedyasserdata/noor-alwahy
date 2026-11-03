import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import {
  TeacherStudentProfile,
  type StudentProfileTab,
} from "@/components/teacher/teacher-student-profile";
import { routing } from "@/i18n/routing";
import { getTeacherStudent360 } from "@/lib/teacher/students";
import { getTeacherReportsData } from "@/lib/reports/queries";

const validTabs: StudentProfileTab[] = [
  "overview",
  "sessions",
  "plan",
  "evaluations",
  "reports",
  "notes",
];

export const instant = false;

export default async function TeacherStudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale, studentId }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();
  const requestedTab = typeof query.tab === "string" ? query.tab : "overview";
  const tab = validTabs.includes(requestedTab as StudentProfileTab)
    ? (requestedTab as StudentProfileTab)
    : "overview";
  const [data, reportsData] = await Promise.all([
    getTeacherStudent360(studentId),
    getTeacherReportsData(),
  ]);
  if (!data) notFound();
  const notice = query.planStatus === "saved" ? "saved" : query.planError ? "error" : undefined;
  const reportNotice =
    query.reportStatus === "saved" || query.reportStatus === "approved"
      ? "saved"
      : query.reportError
        ? "error"
        : undefined;
  const noteNotice =
    query.noteStatus === "saved" ? "saved" : query.noteStatus === "error" ? "error" : undefined;
  return (
    <TeacherStudentProfile
      data={data}
      locale={locale}
      tab={tab}
      notice={notice}
      reportNotice={reportNotice}
      noteNotice={noteNotice}
      reportsData={reportsData}
    />
  );
}
