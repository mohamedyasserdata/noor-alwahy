import { z } from "zod";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ locale: z.enum(["ar", "en"]).default("ar") });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return new Response(null, { status: 400 });
  await requireRole("admin", parsed.data.locale);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "order_no,status,student_name,student_gender,student_age,guardian_name,contact_email,contact_phone,country_code,timezone,self_level,source,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return Response.json({ error: "export_failed" }, { status: 503 });
  const headers = [
    "order_no",
    "status",
    "student_name",
    "student_gender",
    "student_age",
    "guardian_name",
    "contact_email",
    "contact_phone",
    "country_code",
    "timezone",
    "self_level",
    "source",
    "created_at",
  ];
  const csv = `\uFEFF${[headers, ...(data ?? []).map((item) => headers.map((key) => String(item[key as keyof typeof item] ?? "")))].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="applications.csv"',
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
