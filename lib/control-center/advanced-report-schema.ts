import { z } from "zod";

export const advancedReportTypeSchema = z.enum([
  "students",
  "sessions",
  "finance",
  "interventions",
]);
export const advancedExportFormatSchema = z.enum(["pdf", "xlsx"]);

export const advancedReportColumns = {
  students: [
    "student_no",
    "full_name",
    "country",
    "status",
    "track",
    "teacher",
    "subscription_status",
    "sessions",
    "attendance_rate",
    "evaluation_average",
  ],
  sessions: [
    "scheduled_at",
    "student",
    "teacher",
    "status",
    "attendance_status",
    "duration_min",
    "track",
    "country",
  ],
  finance: [
    "invoice_no",
    "student",
    "country",
    "currency",
    "total",
    "paid",
    "outstanding",
    "status",
    "due_date",
    "created_at",
  ],
  interventions: [
    "rule_type",
    "subject_type",
    "subject_id",
    "priority",
    "status",
    "reason_code",
    "recommended_action",
    "first_detected_at",
    "last_detected_at",
    "detection_count",
  ],
} as const;

export type AdvancedReportType = z.infer<typeof advancedReportTypeSchema>;
export type AdvancedExportFormat = z.infer<typeof advancedExportFormatSchema>;
export type AdvancedReportRow = Record<string, string | number | boolean | null>;

const optionalCode = z.union([z.literal(""), z.string().regex(/^[A-Z]{2}$/)]).default("");
const optionalUuid = z.union([z.literal(""), z.string().uuid()]).default("");

export const advancedReportFiltersSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    country: optionalCode,
    track: optionalUuid,
    teacher: optionalUuid,
    status: z.string().trim().max(40).default(""),
    sort: z.string().trim().max(40).default(""),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((value) => value.from <= value.to, { path: ["to"], message: "invalid_period" });

export const advancedExportRequestSchema = z
  .object({
    reportType: advancedReportTypeSchema,
    format: advancedExportFormatSchema,
    locale: z.enum(["ar", "en"]),
    timezone: z.string().trim().min(1).max(100),
    filters: advancedReportFiltersSchema,
    columns: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  })
  .superRefine((value, context) => {
    const allowed = new Set<string>(advancedReportColumns[value.reportType]);
    if (new Set(value.columns).size !== value.columns.length) {
      context.addIssue({ code: "custom", path: ["columns"], message: "duplicate_columns" });
    }
    if (value.columns.some((column) => !allowed.has(column))) {
      context.addIssue({ code: "custom", path: ["columns"], message: "invalid_columns" });
    }
  });

export const advancedReportResponseSchema = z.object({
  report_type: advancedReportTypeSchema,
  page: z.coerce.number().int().positive(),
  page_size: z.coerce.number().int().positive(),
  total: z.coerce.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  currency_totals: z.array(
    z.object({
      currency: z.string(),
      total: z.coerce.number(),
      paid: z.coerce.number(),
      outstanding: z.coerce.number(),
    }),
  ),
  filters: z.record(z.string(), z.unknown()),
  refreshed_at: z.string(),
});

export type AdvancedReportResponse = z.infer<typeof advancedReportResponseSchema>;

export function reportColumnLabel(column: string, locale: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    student_no: ["رقم الطالب", "Student no."],
    full_name: ["الاسم", "Name"],
    country: ["الدولة", "Country"],
    status: ["الحالة", "Status"],
    track: ["المسار", "Track"],
    teacher: ["المدرس", "Teacher"],
    subscription_status: ["حالة الاشتراك", "Subscription status"],
    sessions: ["الحصص", "Sessions"],
    attendance_rate: ["نسبة الحضور", "Attendance rate"],
    evaluation_average: ["متوسط التقييم", "Evaluation average"],
    scheduled_at: ["موعد الحصة", "Scheduled at"],
    student: ["الطالب", "Student"],
    attendance_status: ["الحضور", "Attendance"],
    duration_min: ["المدة بالدقائق", "Duration (min)"],
    invoice_no: ["رقم الفاتورة", "Invoice no."],
    currency: ["العملة", "Currency"],
    total: ["الإجمالي", "Total"],
    paid: ["المدفوع", "Paid"],
    outstanding: ["المتبقي", "Outstanding"],
    due_date: ["الاستحقاق", "Due date"],
    created_at: ["تاريخ الإنشاء", "Created at"],
    rule_type: ["نوع القاعدة", "Rule type"],
    subject_type: ["نوع السجل", "Subject type"],
    subject_id: ["معرف السجل", "Subject ID"],
    priority: ["الأولوية", "Priority"],
    reason_code: ["السبب", "Reason"],
    recommended_action: ["الإجراء المقترح", "Recommended action"],
    first_detected_at: ["أول اكتشاف", "First detected"],
    last_detected_at: ["آخر اكتشاف", "Last detected"],
    detection_count: ["مرات الاكتشاف", "Detection count"],
  };
  return labels[column]?.[locale === "ar" ? 0 : 1] ?? column;
}
