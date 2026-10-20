import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

export type ReportPdfDocument = {
  locale: "ar" | "en";
  studentName: string;
  teacherName: string;
  periodType: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  body: {
    metrics: {
      mastered_pages: number;
      attendance: { total: number; present: number; rate: number | null };
      evaluation_average: number | null;
      criteria_average: Record<string, number>;
    };
    summary: string;
    strengths: string;
    improve: string;
    plan: string;
    recommendation: string;
  };
};

const fontRoot = join(process.cwd(), "node_modules", "@fontsource-variable", "cairo", "files");

export async function renderReportPdf(document: ReportPdfDocument) {
  const html = await createReportHtml(document);
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? {} : { args: chromium.args }),
    defaultViewport: { height: 960, width: 1280 },
    executablePath: await resolveChromiumExecutable(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await page.pdf({ format: "A4", outline: true, printBackground: true, tagged: true });
  } finally {
    await browser.close();
  }
}

export async function createReportHtml(document: ReportPdfDocument) {
  const [arabicFont, latinFont] = await Promise.all([
    loadFont(join(fontRoot, "cairo-arabic-wght-normal.woff2")),
    loadFont(join(fontRoot, "cairo-latin-wght-normal.woff2")),
  ]);
  const ar = document.locale === "ar";
  const labels = ar
    ? {
        brand: "أكاديمية نور الوحي",
        title: "تقرير متابعة الطالب",
        student: "الطالب",
        teacher: "المدرس",
        period: "الفترة",
        weekly: "أسبوعي",
        monthly: "شهري",
        pages: "صفحات متقنة",
        attendance: "نسبة الحضور",
        evaluation: "متوسط التقييم",
        summary: "ملخص التقدم",
        strengths: "نقاط القوة",
        improve: "ما يحتاج إلى تحسين",
        plan: "خطة الفترة القادمة",
        recommendation: "التوصية",
        generated: "صدر آليًا من السجلات المعتمدة",
      }
    : {
        brand: "Noor Al-Wahy Academy",
        title: "Student progress report",
        student: "Student",
        teacher: "Teacher",
        period: "Period",
        weekly: "Weekly",
        monthly: "Monthly",
        pages: "Mastered pages",
        attendance: "Attendance",
        evaluation: "Evaluation average",
        summary: "Progress summary",
        strengths: "Strengths",
        improve: "Areas to improve",
        plan: "Next-period plan",
        recommendation: "Recommendation",
        generated: "Generated from approved academy records",
      };
  const metric = (value: number | null, suffix = "") => (value == null ? "—" : `${value}${suffix}`);
  const narrative = (["summary", "strengths", "improve", "plan", "recommendation"] as const)
    .map(
      (key) => `<section><h2>${labels[key]}</h2><p>${escapeHtml(document.body[key])}</p></section>`,
    )
    .join("");
  return `<!doctype html><html lang="${document.locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Cairo;src:url('${arabicFont}') format('woff2');font-weight:200 1000}@font-face{font-family:CairoLatin;src:url('${latinFont}') format('woff2');font-weight:200 1000}@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#102b50;background:#fff;font:10.5pt/1.75 Cairo,CairoLatin,sans-serif}header{position:relative;overflow:hidden;border-radius:5mm;background:#102b50;color:white;padding:8mm}header:after{content:"";position:absolute;inset-inline-end:-18mm;inset-block-start:-24mm;width:55mm;height:55mm;border:1.5mm solid #d3aa45;border-radius:50%;opacity:.55}.brand{color:#d3aa45;font-weight:850}.title{margin:2mm 0 0;font-size:24pt;line-height:1.35}.identity{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-block-start:5mm}.identity div{border:1px solid #ffffff30;border-radius:3mm;padding:3mm}.identity span{display:block;color:#cbd6e6;font-size:8pt}.identity strong{display:block;margin-block-start:1mm}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:7mm 0}.metric{border:.35mm solid #d9dfe8;border-block-start:1.4mm solid #d3aa45;border-radius:3mm;padding:4mm;text-align:center}.metric span{display:block;color:#66758a;font-size:8pt}.metric strong{font-size:20pt;color:#102b50}.narrative{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.narrative section{break-inside:avoid;border:.3mm solid #d9dfe8;border-radius:3mm;padding:4mm}.narrative section:last-child{grid-column:1/-1}.narrative h2{margin:0 0 2mm;color:#a67d1f;font-size:11pt}.narrative p{margin:0;white-space:pre-wrap}footer{margin-block-start:7mm;border-block-start:.3mm solid #d9dfe8;padding-block-start:3mm;color:#718096;font-size:7.5pt;text-align:center}
  </style></head><body><header><div class="brand">${labels.brand}</div><h1 class="title">${labels.title}</h1><div class="identity"><div><span>${labels.student}</span><strong>${escapeHtml(document.studentName)}</strong></div><div><span>${labels.teacher}</span><strong>${escapeHtml(document.teacherName)}</strong></div><div><span>${labels.period}</span><strong>${document.periodType === "weekly" ? labels.weekly : labels.monthly}<br><span dir="ltr">${escapeHtml(document.periodStart)} — ${escapeHtml(document.periodEnd)}</span></strong></div></div></header><main><div class="metrics"><div class="metric"><span>${labels.pages}</span><strong>${document.body.metrics.mastered_pages}</strong></div><div class="metric"><span>${labels.attendance}</span><strong>${metric(document.body.metrics.attendance.rate, "%")}</strong></div><div class="metric"><span>${labels.evaluation}</span><strong>${metric(document.body.metrics.evaluation_average, "%")}</strong></div></div><div class="narrative">${narrative}</div></main><footer>${labels.generated} · <span dir="ltr">${escapeHtml(document.generatedAt.slice(0, 10))}</span></footer></body></html>`;
}

async function resolveChromiumExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const packUrl = process.env.CHROMIUM_PACK_URL;
  if (!packUrl) throw new Error("chromium_runtime_unavailable");
  const parsed = new URL(packUrl);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("invalid_chromium_pack_url");
  return chromium.executablePath(parsed.toString());
}
async function loadFont(path: string) {
  return `data:font/woff2;base64,${(await readFile(path)).toString("base64")}`;
}
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
