import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AttendanceReportFilters } from "@/lib/validators/attendance";
import type { Database } from "@/types/database.types";

export type AttendanceReportRow =
  Database["public"]["Functions"]["get_attendance_report"]["Returns"][number];

export async function getAttendanceReport(filters: AttendanceReportFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attendance_report", {
    p_anchor: filters.anchor,
    p_period: filters.period,
  });

  if (error) throw new Error("attendance_report_unavailable");
  return data satisfies AttendanceReportRow[];
}
