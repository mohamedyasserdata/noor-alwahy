import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

export type GradeReportDocument = {
  locale: "ar" | "en";
  studentName: string;
  generatedAt: string;
  results: {
    title: string;
    kind: "monthly" | "term" | "final" | "juz";
    heldOn: string;
    total: number;
    maximum: number;
    percentage: number;
    grade: "repeat" | "pass" | "good" | "very_good" | "excellent";
  }[];
};

const fontRoot = join(process.cwd(), "node_modules", "@fontsource-variable", "cairo", "files");

export async function renderGradeReportPdf(document: GradeReportDocument) {
  const html = await createGradeReportHtml(document);
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

export async function createGradeReportHtml(document: GradeReportDocument) {
  const [arabicFont, latinFont] = await Promise.all([
    loadFont(join(fontRoot, "cairo-arabic-wght-normal.woff2")),
    loadFont(join(fontRoot, "cairo-latin-wght-normal.woff2")),
  ]);
  const ar = document.locale === "ar";
  const labels = ar
    ? {
        academy: "أكاديمية نور الوحي",
        title: "كشف الدرجات المعتمد",
        student: "الطالب",
        average: "المتوسط العام",
        exams: "عدد الاختبارات",
        exam: "الاختبار",
        kind: "النوع",
        date: "التاريخ",
        score: "الدرجة",
        percentage: "النسبة",
        grade: "التقدير",
        note: "يعرض هذا الكشف النتائج المعتمدة والمقفلة فقط.",
        kinds: { monthly: "شهري", term: "فصلي", final: "نهائي", juz: "جزء" },
        grades: {
          repeat: "يحتاج إعادة",
          pass: "مقبول",
          good: "جيد",
          very_good: "جيد جدًا",
          excellent: "ممتاز",
        },
      }
    : {
        academy: "Noor Al-Wahy Academy",
        title: "Official grade report",
        student: "Student",
        average: "Overall average",
        exams: "Exams",
        exam: "Exam",
        kind: "Type",
        date: "Date",
        score: "Score",
        percentage: "Percentage",
        grade: "Grade",
        note: "This report includes approved and locked results only.",
        kinds: { monthly: "Monthly", term: "Term", final: "Final", juz: "Juz" },
        grades: {
          repeat: "Repeat required",
          pass: "Pass",
          good: "Good",
          very_good: "Very good",
          excellent: "Excellent",
        },
      };
  const average =
    document.results.reduce((total, result) => total + Number(result.percentage), 0) /
    document.results.length;
  const rows = document.results
    .map(
      (result) =>
        `<tr><td>${escapeHtml(result.title)}</td><td>${labels.kinds[result.kind]}</td><td dir="ltr">${escapeHtml(result.heldOn)}</td><td dir="ltr">${formatNumber(result.total, document.locale)} / ${formatNumber(result.maximum, document.locale)}</td><td dir="ltr">${formatNumber(result.percentage, document.locale)}%</td><td>${labels.grades[result.grade]}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="${document.locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Cairo;src:url('${arabicFont}') format('woff2');font-weight:200 1000}@font-face{font-family:CairoLatin;src:url('${latinFont}') format('woff2');font-weight:200 1000}@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#102b50;background:#fff;font:10pt/1.65 Cairo,CairoLatin,sans-serif}header{position:relative;overflow:hidden;border-radius:5mm;background:#102b50;color:#fff;padding:9mm}header:after{content:"";position:absolute;inset-inline-end:-17mm;inset-block-start:-25mm;width:65mm;height:65mm;border:1.7mm solid #d3aa45;border-radius:50%;opacity:.5}.academy{font-weight:900;color:#d3aa45}.title{margin:2mm 0 0;font-size:24pt}.student{margin-block-start:5mm;color:#d9e2ef}.student strong{color:#fff}.summary{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:7mm 0}.summary div{border:.35mm solid #d7deea;border-block-start:1.3mm solid #d3aa45;border-radius:3mm;padding:4mm;text-align:center}.summary span{display:block;color:#66758a;font-size:8pt}.summary strong{display:block;margin-block-start:1mm;font-size:19pt}table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{break-inside:avoid}th{background:#f7efd9;color:#765614;font-size:8pt;text-align:start}th,td{border:.3mm solid #d7deea;padding:3mm 2.5mm}tbody tr:nth-child(even){background:#f8fafc}footer{margin-block-start:7mm;border-block-start:.3mm solid #d7deea;padding-block-start:3mm;color:#718096;font-size:7.5pt;text-align:center}
  </style></head><body><header><div class="academy">${labels.academy}</div><h1 class="title">${labels.title}</h1><div class="student">${labels.student}: <strong>${escapeHtml(document.studentName)}</strong></div></header><main><div class="summary"><div><span>${labels.average}</span><strong dir="ltr">${formatNumber(average, document.locale)}%</strong></div><div><span>${labels.exams}</span><strong>${document.results.length}</strong></div></div><table><thead><tr><th>${labels.exam}</th><th>${labels.kind}</th><th>${labels.date}</th><th>${labels.score}</th><th>${labels.percentage}</th><th>${labels.grade}</th></tr></thead><tbody>${rows}</tbody></table></main><footer>${labels.note} · <span dir="ltr">${escapeHtml(document.generatedAt.slice(0, 10))}</span></footer></body></html>`;
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
function formatNumber(value: number, locale: "ar" | "en") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value));
}
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
