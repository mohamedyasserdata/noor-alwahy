import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { renderReceiptPdf } from "../lib/billing/receipt-pdf";
import { renderFinancialPdf } from "../lib/billing/financial-export";
import { renderCertificatePdf } from "../lib/certificates/pdf";
import { renderAdvancedReportPdf } from "../lib/control-center/advanced-export-renderers";
import { renderAdminDashboardPdf } from "../lib/dashboard/export-pdf";
import { renderGradeReportPdf } from "../lib/exams/grade-report-pdf";
import { renderPayoutPdf } from "../lib/payouts/export";
import { renderReportPdf } from "../lib/reports/pdf";

const output = join(process.cwd(), "output", "pdf", "quality-gate");
await mkdir(output, { recursive: true });
const generatedAt = "2026-10-23T18:00:00.000Z";

const files = await Promise.all([
  sample("certificate-ar.pdf", () =>
    renderCertificatePdf({
      locale: "ar",
      serialNo: "NAW-2026-00000042",
      verifyUrl: "http://127.0.0.1:3000/ar/verify/ABCDEFGHIJKLMNOPQRSTUVWX12345678",
      payload: {
        student_name: "عبد الرحمن محمد عبد الله مصطفى الطويل",
        achievement: "إتمام حفظ جزء عمّ ومراجعته بإتقان مع التزام متميز بالحضور",
        issued_on: "2026-10-23",
        serial_no: "NAW-2026-00000042",
      },
      template: {
        title_ar: "شهادة حفظ وتفوق",
        title_en: "Memorization & Excellence Certificate",
        body_ar:
          "تشهد أكاديمية نور الوحي بأن الطالب {{student_name}} قد حقق {{achievement}}، وتمنحه هذه الشهادة تقديرًا لجهده المبارك.",
        body_en: "Noor Al-Wahy Academy certifies that {{student_name}} achieved {{achievement}}.",
        theme: { style: "arabesque", primary: "#102b50", accent: "#d3aa45" },
        signatures: [
          { name: "أ. محمد عبد الرحيم", title: "مدير الأكاديمية" },
          { name: "أ. أحمد مصطفى", title: "المشرف التعليمي" },
        ],
      },
      assets: { signatures: {} },
    }),
  ),
  sample("certificate-en.pdf", () =>
    renderCertificatePdf({
      locale: "en",
      serialNo: "NAW-2026-00000043",
      verifyUrl: "http://127.0.0.1:3000/en/verify/ZYXWVUTSRQPONMLKJIHGFEDC87654321",
      payload: {
        student_name: "Abdulrahman Mohammed Abdullah Al-Mustafa",
        achievement: "excellent attendance and consistent memorization progress",
        issued_on: "2026-10-23",
        serial_no: "NAW-2026-00000043",
      },
      template: {
        title_ar: "شهادة تفوق",
        title_en: "Certificate of Excellence",
        body_ar: "تمنح إلى {{student_name}} تقديرًا لـ {{achievement}}.",
        body_en:
          "Noor Al-Wahy Academy proudly awards this certificate to {{student_name}} for {{achievement}}.",
        theme: { style: "illuminated", primary: "#102b50", accent: "#d3aa45" },
        signatures: [{ name: "Mohamed Abdelrahim", title: "Academy Director" }],
      },
      assets: { signatures: {} },
    }),
  ),
  sample("grade-report-ar.pdf", () =>
    renderGradeReportPdf({
      locale: "ar",
      studentName: "مريم عبد الرحمن محمود السيد",
      generatedAt,
      results: [
        {
          title: "اختبار الحفظ الشهري - جزء عمّ",
          kind: "monthly",
          heldOn: "2026-10-05",
          total: 47,
          maximum: 50,
          percentage: 94,
          grade: "excellent",
        },
        {
          title: "اختبار أحكام التجويد للفصل الأول",
          kind: "term",
          heldOn: "2026-10-20",
          total: 43,
          maximum: 50,
          percentage: 86,
          grade: "very_good",
        },
      ],
    }),
  ),
  sample("receipt-ar.pdf", () =>
    renderReceiptPdf({
      locale: "ar",
      receiptNo: "RCT-2026-000042",
      invoiceNo: "INV-2026-000037",
      studentName: "عبد الرحمن محمد عبد الله مصطفى الطويل",
      kind: "payment",
      amount: "1250.00",
      currency: "EGP",
      method: "تحويل بنكي - حساب الأكاديمية",
      paidAt: "2026-10-22T12:15:00.000Z",
      confirmedAt: "2026-10-23T08:30:00.000Z",
    }),
  ),
  sample("student-report-ar.pdf", () =>
    renderReportPdf({
      locale: "ar",
      studentName: "عبد الرحمن محمد عبد الله مصطفى الطويل",
      teacherName: "أحمد محمود عبد القادر",
      periodType: "monthly",
      periodStart: "2026-09-23",
      periodEnd: "2026-10-23",
      generatedAt,
      body: {
        metrics: {
          mastered_pages: 18,
          attendance: { total: 12, present: 11, rate: 91.67 },
          evaluation_average: 88.4,
          criteria_average: { tajweed: 4.4 },
        },
        summary: "أظهر الطالب تقدمًا ثابتًا في الحفظ والمراجعة خلال هذا الشهر.",
        strengths: "انتظام الحضور، وضوح التلاوة، والاستجابة السريعة للتصحيح.",
        improve: "زيادة التركيز في مواضع الوقف والابتداء ومراجعة الصفحات الأقدم.",
        plan: "مراجعة خمس صفحات أسبوعيًا مع تثبيت الحفظ الجديد.",
        recommendation: "الاستمرار على الخطة الحالية مع جلسة مراجعة إضافية كل أسبوعين.",
      },
    }),
  ),
  sample("financial-report-ar.pdf", () =>
    renderFinancialPdf(
      [
        {
          currency: "EGP",
          invoiced: 120000,
          received: 105000,
          refunded: 2500,
          expenses: 38000,
          outstanding: 15000,
          netCash: 64500,
        },
        {
          currency: "SAR",
          invoiced: 18500,
          received: 17200,
          refunded: 0,
          expenses: 4200,
          outstanding: 1300,
          netCash: 13000,
        },
      ],
      "ar",
      generatedAt,
    ),
  ),
  sample("teacher-payout-ar.pdf", () =>
    renderPayoutPdf({
      locale: "ar",
      payoutNo: "PAY-2026-000018",
      teacher: "أحمد محمود عبد القادر",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      currency: "EGP",
      gross: 5200,
      bonuses: 300,
      deductions: 150,
      net: 5350,
      status: "معتمد",
      items: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-10-${String(index + 1).padStart(2, "0")}`,
        kind: index % 3 === 0 ? "حصة تعويضية" : "حصة أساسية",
        rate: 350,
        amount: 350,
      })),
      adjustments: [{ kind: "bonus", amount: 300, reason: "التزام متميز" }],
    }),
  ),
  sample("advanced-students-ar.pdf", () =>
    renderAdvancedReportPdf(
      {
        report_type: "students",
        page: 1,
        page_size: 50,
        total: 2,
        rows: [
          {
            student_no: "NW-000042",
            full_name: "عبد الرحمن محمد عبد الله مصطفى الطويل",
            country: "EG",
            status: "active",
            track: "حفظ القرآن الكريم",
            teacher: "أحمد محمود",
            subscription_status: "active",
            sessions: 12,
            attendance_rate: 91.67,
            evaluation_average: 88.4,
          },
          {
            student_no: "NW-000043",
            full_name: "مريم عبد الرحمن محمود السيد",
            country: "SA",
            status: "active",
            track: "القاعدة النورانية",
            teacher: "فاطمة علي",
            subscription_status: "trial",
            sessions: 8,
            attendance_rate: 100,
            evaluation_average: 93,
          },
        ],
        currency_totals: [],
        filters: { from: "2026-10-01", to: "2026-10-23" },
        refreshed_at: generatedAt,
      },
      {
        reportType: "students",
        locale: "ar",
        timezone: "Africa/Cairo",
        columns: [
          "student_no",
          "full_name",
          "country",
          "status",
          "track",
          "teacher",
          "attendance_rate",
          "evaluation_average",
        ],
        filters: { from: "2026-10-01", to: "2026-10-23", country: "" },
        generatedAt,
      },
    ),
  ),
  sample("admin-dashboard-en.pdf", () =>
    renderAdminDashboardPdf(
      {
        totals: {
          students: 128,
          teachers: 14,
          active_subscriptions: 102,
          new_applications: 17,
          today_attendance: 92.4,
        },
        conversion_rate: 64.2,
        churn_rate: 3.1,
        mrr: [
          { currency: "EGP", amount: 125000 },
          { currency: "SAR", amount: 18400 },
        ],
        overdue: [{ currency: "EGP", amount: 8500 }],
        attendance: [
          { day: "2026-10-20", rate: 91 },
          { day: "2026-10-21", rate: 94 },
        ],
        finance: [{ month: "2026-10-01", currency: "EGP", revenue: 105000, expense: 38000 }],
        levels: [{ name_ar: "مبتدئ", name_en: "Beginner", students: 48 }],
        teachers: [{ id: "teacher-1", name: "Ahmed Mahmoud", rate: 96, eligible: 42 }],
        packages: [{ name_ar: "الباقة الأساسية", name_en: "Foundation", subscriptions: 56 }],
        countries: [
          { country: "EG", students: 90 },
          { country: "SA", students: 38 },
        ],
        currencies: ["EGP", "SAR"],
        recent_activity: [],
        riskFlags: [
          {
            student_id: "student-1",
            student_no: "NW-000099",
            full_name: "Long Student Name for Layout Validation",
            country: "EG",
            level_name_ar: "مبتدئ",
            level_name_en: "Beginner",
            risk_score: 65,
            risk_level: "high",
            reasons: ["attendance_critical", "report_overdue"],
            eligible_sessions: 10,
            absent_sessions: 5,
            absence_rate: 50,
            inactive_days: 22,
            evaluation_average: 58,
            overdue_review_pages: 7,
            subscription_status: "active",
            subscription_period_end: "2026-11-01",
            last_report_period_end: "2026-08-01",
          },
        ],
      },
      "en",
      { from: "2026-09-23", to: "2026-10-23", country: "", currency: "", generatedAt },
    ),
  ),
]);

for (const [name, bytes] of files) await writeFile(join(output, name), bytes);
process.stdout.write(`${files.length} PDF quality samples written to ${output}\n`);

async function sample(name: string, render: () => Promise<Uint8Array>) {
  return [name, await render()] as const;
}
