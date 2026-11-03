import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { TeacherSessionWorkspace } from "@/components/sessions/teacher-session-workspace";
import { routing } from "@/i18n/routing";
import { getTeacherSessionWorkspace } from "@/lib/sessions/workspace";

export const instant = false;

export default async function TeacherSessionWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale, sessionId }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();
  const data = await getTeacherSessionWorkspace(sessionId);
  if (!data) notFound();
  return <TeacherSessionWorkspace data={data} locale={locale} query={query} />;
}
