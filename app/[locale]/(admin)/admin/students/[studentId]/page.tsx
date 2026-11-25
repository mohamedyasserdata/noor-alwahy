import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AdminStudentProfile } from "@/components/admin/admin-student-profile";
import { routing } from "@/i18n/routing";
import { getAdminStudentProfile } from "@/lib/admin/student-profile";

export const instant = false;

export default async function AdminStudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, studentId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [data, query] = await Promise.all([
    getAdminStudentProfile(studentId, locale),
    searchParams,
  ]);
  if (!data) notFound();
  return <AdminStudentProfile locale={locale} data={data} query={query} />;
}
