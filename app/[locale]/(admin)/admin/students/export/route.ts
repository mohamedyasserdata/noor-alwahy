import { NextResponse } from "next/server";

import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/require-role";
import { getStudentsForExport } from "@/lib/students/student-management";
import { createClient } from "@/lib/supabase/server";
import { studentFiltersSchema } from "@/lib/validators/students";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new NextResponse(null, { status: 404 });
  await requireRole("admin", locale);
  const url = new URL(request.url);
  const parsed = studentFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
  const filters = parsed.success ? parsed.data : studentFiltersSchema.parse({});
  const students = await getStudentsForExport(filters, locale);
  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("record_student_export", {
    p_count: students.length,
  });
  if (auditError) {
    return new Response(null, { status: 500 });
  }
  const headers =
    locale === "ar"
      ? [
          "رقم الطالب",
          "الاسم",
          "الحالة",
          "المستوى",
          "المسار",
          "الدولة",
          "المنطقة الزمنية",
          "تاريخ الانضمام",
        ]
      : ["Student number", "Name", "Status", "Level", "Track", "Country", "Timezone", "Joined at"];
  const rows = students.map((student) => [
    student.studentNo,
    student.fullName,
    student.status,
    student.levelName ?? "",
    student.trackName ?? "",
    student.countryCode ?? "",
    student.timezone,
    student.joinedAt,
  ]);
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": 'attachment; filename="noor-students.csv"',
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
