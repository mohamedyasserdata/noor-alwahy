import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { TeacherStudentsCenter } from "@/components/teacher/teacher-students-center";
import { routing } from "@/i18n/routing";
import type { TeacherStudentFilters } from "@/lib/teacher/students";

type Query = Record<string, string | string[] | undefined>;

export const instant = false;

export default async function TeacherStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();
  const filters: TeacherStudentFilters = {
    q: stringValue(query.q),
    page: positiveInteger(query.page),
    status: allowed(query.status, [
      "all",
      "active",
      "dropped",
      "graduated",
      "suspended",
      "archived",
    ]),
    followUp: allowed(query.followUp, ["all", "regular", "needs_follow_up", "evaluation_pending"]),
    sort: allowed(query.sort, ["name", "next_session", "recent_evaluation"]),
  };
  return <TeacherStudentsCenter locale={locale} filters={filters} />;
}

function stringValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value.slice(0, 120) : undefined;
}

function positiveInteger(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function allowed<T extends string>(value: string | string[] | undefined, values: readonly T[]) {
  return typeof value === "string" && values.includes(value as T) ? (value as T) : undefined;
}
