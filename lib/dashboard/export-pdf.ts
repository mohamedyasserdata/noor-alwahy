import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

import type { AdminDashboardReport } from "@/lib/dashboard/admin-dashboard";

export async function renderAdminDashboardPdf(
  data: AdminDashboardReport,
  locale: "ar" | "en",
  filters: { from: string; to: string; country: string; currency: string; generatedAt: string },
) {
  const html = await dashboardHtml(data, locale, filters);
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? {} : { args: chromium.args }),
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font:9px Arial;width:100%;text-align:center;color:#64748b"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "12mm", bottom: "16mm" },
    });
  } finally {
    await browser.close();
  }
}

async function dashboardHtml(
  data: AdminDashboardReport,
  locale: "ar" | "en",
  filters: { from: string; to: string; country: string; currency: string; generatedAt: string },
) {
  const ar = locale === "ar";
  const label = (arabic: string, english: string) => (ar ? arabic : english);
  const fontPath = join(
    process.cwd(),
    "node_modules",
    "@fontsource-variable",
    "cairo",
    "files",
    ar ? "cairo-arabic-wght-normal.woff2" : "cairo-latin-wght-normal.woff2",
  );
  const font = `data:font/woff2;base64,${(await readFile(fontPath)).toString("base64")}`;
  const metrics = [
    [label("الطلاب النشطون", "Active students"), data.totals.students],
    [label("المدرسون النشطون", "Active teachers"), data.totals.teachers],
    [label("الاشتراكات الفعالة", "Active subscriptions"), data.totals.active_subscriptions],
    [label("طلبات جديدة", "New applications"), data.totals.new_applications],
    [label("حضور اليوم", "Attendance today"), percent(data.totals.today_attendance)],
    [label("التحويل", "Conversion"), percent(data.conversion_rate)],
    [label("التسرب الشهري", "Monthly churn"), percent(data.churn_rate)],
    [label("أعلام خطر التسرب", "Dropout risk flags"), data.riskFlags.length],
  ];
  const moneyRows = [
    ...data.mrr.map((row) => [label("الإيراد الشهري المتكرر", "MRR"), row.currency, row.amount]),
    ...data.overdue.map((row) => [label("المتأخرات", "Overdue"), row.currency, row.amount]),
  ];
  const riskRows = data.riskFlags.map((row) => [
    row.student_no,
    row.full_name,
    row.country ?? "-",
    ar ? row.level_name_ar : row.level_name_en,
    row.risk_score,
    riskLabel(row.risk_level, ar),
    row.reasons.map((reason) => reasonLabel(reason, ar)).join(", "),
    row.absence_rate == null ? "-" : `${row.absence_rate}%`,
    row.inactive_days ?? "-",
    row.overdue_review_pages,
  ]);
  return `<!doctype html><html lang="${locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
    @font-face{font-family:Cairo;src:url('${font}')}*{box-sizing:border-box}body{margin:0;padding-inline:12mm;font:9pt/1.55 Cairo,Arial;color:#102b50}header{background:#102b50;color:white;border-radius:4mm;padding:7mm}h1{margin:0;color:#d3aa45;font-size:22pt}header p{margin:2mm 0 0}.meta{display:flex;gap:5mm;flex-wrap:wrap;margin-top:4mm}.meta span{background:#fff1;padding:1.5mm 3mm;border-radius:4mm}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:6mm 0}.metric{border:.3mm solid #d7dee8;border-top:1.3mm solid #d3aa45;padding:4mm}.metric b{display:block;font-size:17pt;margin-top:1mm}.section{margin-top:6mm;break-inside:avoid}.section.break{break-before:page}h2{font-size:14pt;margin:0 0 3mm;border-bottom:.5mm solid #d3aa45;padding-bottom:2mm}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#102b50;color:white}th,td{border:.25mm solid #d7dee8;padding:2mm;vertical-align:top;text-align:start;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f8fafc}.numeric{direction:ltr;font-variant-numeric:tabular-nums}.small{font-size:7.5pt}.risk-high{color:#991b1b;font-weight:800}.risk-medium{color:#92400e;font-weight:800}.empty{padding:8mm;text-align:center;color:#64748b}
  </style></head><body><header><h1>${label("تقرير لوحة إدارة أكاديمية نور الوحي", "Noor Al-Wahy administration dashboard report")}</h1><p>${label("نسخة ثابتة من البيانات المصرح بها وقت التصدير", "A fixed snapshot of the authorized data at export time")}</p><div class="meta"><span>${label("الفترة", "Period")}: ${escapeHtml(filters.from)} - ${escapeHtml(filters.to)}</span><span>${label("الدولة", "Country")}: ${escapeHtml(filters.country || label("الكل", "All"))}</span><span>${label("العملة", "Currency")}: ${escapeHtml(filters.currency || label("الكل", "All"))}</span><span>${label("أُنشئ", "Generated")}: ${escapeHtml(filters.generatedAt)}</span></div></header>
  <section class="metrics">${metrics.map(([name, value]) => `<div class="metric"><span>${escapeHtml(String(name))}</span><b class="numeric">${escapeHtml(String(value ?? "-"))}</b></div>`).join("")}</section>
  ${tableSection(label("المال حسب العملة", "Money by currency"), [label("المؤشر", "Metric"), label("العملة", "Currency"), label("القيمة", "Amount")], moneyRows)}
  ${tableSection(
    label("اتجاه الحضور", "Attendance trend"),
    [label("اليوم", "Day"), label("الحضور", "Attendance")],
    data.attendance.map((row) => [row.day, percent(row.rate)]),
  )}
  ${tableSection(
    label("الإيراد والمصروف", "Revenue and expense"),
    [
      label("الشهر", "Month"),
      label("العملة", "Currency"),
      label("الإيراد", "Revenue"),
      label("المصروف", "Expense"),
    ],
    data.finance.map((row) => [row.month, row.currency, row.revenue, row.expense]),
  )}
  ${tableSection(
    label("توزيع المستويات", "Level distribution"),
    [label("المستوى", "Level"), label("الطلاب", "Students")],
    data.levels.map((row) => [ar ? row.name_ar : row.name_en, row.students]),
  )}
  ${tableSection(
    label("التزام المدرسين", "Teacher commitment"),
    [
      label("المدرس", "Teacher"),
      label("الالتزام", "Commitment"),
      label("الحصص المحتسبة", "Eligible sessions"),
    ],
    data.teachers.map((row) => [row.name, percent(row.rate), row.eligible]),
  )}
  ${tableSection(
    label("أكثر الباقات اشتراكًا", "Top packages"),
    [label("الباقة", "Package"), label("الاشتراكات", "Subscriptions")],
    data.packages.map((row) => [ar || !row.name_en ? row.name_ar : row.name_en, row.subscriptions]),
  )}
  <div class="section break"><h2>${label("أعلام خطر التسرب", "Dropout risk flags")}</h2>${riskRows.length ? `<table class="small"><thead><tr>${[label("الرقم", "No."), label("الطالب", "Student"), label("الدولة", "Country"), label("المستوى", "Level"), label("الدرجة", "Score"), label("الخطر", "Risk"), label("الأسباب", "Reasons"), label("الغياب", "Absence"), label("عدم النشاط", "Inactive"), label("مراجعات متأخرة", "Overdue reviews")].map((heading) => `<th>${heading}</th>`).join("")}</tr></thead><tbody>${riskRows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index === 5 ? `risk-${data.riskFlags[riskRows.indexOf(row)]?.risk_level}` : index >= 4 ? "numeric" : ""}">${escapeHtml(String(cell))}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<p class="empty">${label("لا توجد أعلام خطر وفق القواعد الحالية.", "No risk flags match the current rules.")}</p>`}</div>
  </body></html>`;
}

function tableSection(
  title: string,
  headings: string[],
  rows: Array<Array<string | number | null>>,
) {
  return `<div class="section"><h2>${escapeHtml(title)}</h2>${rows.length ? `<table><thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index > 0 ? "numeric" : ""}">${escapeHtml(String(cell ?? "-"))}</td>`).join("")}</tr>`).join("")}</tbody></table>` : '<p class="empty">-</p>'}</div>`;
}
function percent(value: number | null) {
  return value == null ? "-" : `${value}%`;
}
function riskLabel(value: "low" | "medium" | "high", ar: boolean) {
  return ar ? { low: "منخفض", medium: "متوسط", high: "مرتفع" }[value] : value;
}
function reasonLabel(value: string, ar: boolean) {
  if (!ar) return value.replaceAll("_", " ");
  return (
    {
      attendance_critical: "غياب حرج",
      attendance_warning: "غياب متكرر",
      inactive_30_days: "عدم حضور 30 يومًا",
      inactive_21_days: "عدم حضور 21 يومًا",
      reviews_critical: "مراجعات متأخرة حرجة",
      reviews_warning: "مراجعات متأخرة",
      evaluation_critical: "تقييم منخفض جدًا",
      evaluation_warning: "تقييم منخفض",
      subscription_inactive: "اشتراك غير فعّال",
      report_overdue: "تقرير متابعة متأخر",
    }[value] ?? value
  );
}
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
