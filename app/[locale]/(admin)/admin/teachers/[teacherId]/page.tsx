import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AdminTeacherProfile } from "@/components/admin/admin-teacher-profile";
import { routing } from "@/i18n/routing";
import { getAdminTeacherProfile } from "@/lib/admin/teacher-profile";

export const instant = false;

export default async function AdminTeacherProfilePage({
  params,
}: {
  params: Promise<{ locale: string; teacherId: string }>;
}) {
  const { locale, teacherId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const data = await getAdminTeacherProfile(teacherId);
  if (!data) notFound();
  return <AdminTeacherProfile locale={locale} data={data} />;
}
