import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type SchedulePdfRow = {
  weekday: number;
  time: string;
  durationMinutes: number;
  studentName: string;
  teacherName: string;
  trackName: string;
};

export type SchedulePdfInput = {
  locale: "ar" | "en";
  ownerName: string;
  timezone: string;
  generatedAt: string;
  rows: SchedulePdfRow[];
};

type PdfFonts = {
  cairoArabic: string;
  cairoLatin: string;
  amiriArabic: string;
  amiriLatin: string;
};

const fontFiles = {
  cairoArabic: "cairo-arabic-variable.woff2",
  cairoLatin: "cairo-latin-variable.woff2",
  amiriArabic: "amiri-arabic-700.woff2",
  amiriLatin: "amiri-latin-700.woff2",
} as const;

const fontsPromise = loadFonts();

export async function createSchedulePdfHtml(input: SchedulePdfInput) {
  return buildSchedulePdfHtml(input, await fontsPromise);
}

export function buildSchedulePdfHtml(input: SchedulePdfInput, fonts: PdfFonts) {
  const isArabic = input.locale === "ar";
  const labels = isArabic
    ? {
        academy: "أكاديمية نور الوحي",
        title: "الجدول الأسبوعي",
        owner: "صاحب الجدول",
        timezone: "المنطقة الزمنية",
        generated: "تاريخ الإصدار",
        day: "اليوم",
        time: "الوقت المحلي",
        duration: "المدة",
        student: "الطالب",
        teacher: "المدرس",
        track: "المسار",
        minutes: "دقيقة",
        empty: "لا توجد حصص أسبوعية نشطة.",
        note: "جميع المواعيد معروضة بالمنطقة الزمنية المكتوبة أعلاه.",
      }
    : {
        academy: "Noor Al-Wahy Academy",
        title: "Weekly schedule",
        owner: "Schedule owner",
        timezone: "Time zone",
        generated: "Generated at",
        day: "Day",
        time: "Local time",
        duration: "Duration",
        student: "Student",
        teacher: "Teacher",
        track: "Track",
        minutes: "minutes",
        empty: "No active weekly sessions.",
        note: "Every time is shown in the time zone printed above.",
      };
  const weekdays = isArabic
    ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const rows = input.rows.length
    ? input.rows
        .map(
          (row) => `<tr>
  <td>${escapeHtml(weekdays[row.weekday] ?? "")}</td>
  <td class="latin">${escapeHtml(row.time)}</td>
  <td>${escapeHtml(`${row.durationMinutes} ${labels.minutes}`)}</td>
  <td>${escapeHtml(row.studentName)}</td>
  <td>${escapeHtml(row.teacherName)}</td>
  <td>${escapeHtml(row.trackName)}</td>
</tr>`,
        )
        .join("")
    : `<tr><td class="empty" colspan="6">${escapeHtml(labels.empty)}</td></tr>`;

  return `<!doctype html>
<html lang="${input.locale}" dir="${isArabic ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><style>
@font-face{font-family:CairoArabic;src:url('${fonts.cairoArabic}') format('woff2');font-weight:200 1000}
@font-face{font-family:CairoLatin;src:url('${fonts.cairoLatin}') format('woff2');font-weight:200 1000}
@font-face{font-family:AmiriArabic;src:url('${fonts.amiriArabic}') format('woff2');font-weight:700}
@font-face{font-family:AmiriLatin;src:url('${fonts.amiriLatin}') format('woff2');font-weight:700}
@page{size:A4 portrait;margin:12mm 10mm}*{box-sizing:border-box}body{margin:0;color:#0f2547;background:#fff;font-family:CairoArabic,CairoLatin,sans-serif;font-size:10pt}
header{border:1px solid #d8c18c;border-radius:5mm;padding:7mm;background:linear-gradient(135deg,#fffdf8,#f3ead5)}.brand{font-weight:800;color:#2e7d5b;letter-spacing:.02em}h1{margin:2mm 0 0;font-family:AmiriArabic,AmiriLatin,serif;font-size:25pt;line-height:1.2}.meta{display:grid;grid-template-columns:1fr 1fr;gap:2mm 8mm;margin-top:5mm}.meta p{margin:0}.label{color:#546a86;font-size:8pt}.value{font-weight:700}.latin{font-family:CairoLatin,CairoArabic,sans-serif;direction:ltr;unicode-bidi:isolate}table{width:100%;margin-top:7mm;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid}th{padding:3mm 2mm;background:#0f2547;color:#fff;font-size:8.5pt}td{padding:3mm 2mm;border-block-end:1px solid #d9e0e8;text-align:center;vertical-align:middle;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f7f9fb}.empty{padding:12mm;color:#546a86}footer{margin-top:6mm;border-block-start:1px solid #d9e0e8;padding-top:3mm;color:#546a86;font-size:8pt;text-align:center}
</style></head>
<body><header><div class="brand">${escapeHtml(labels.academy)}</div><h1>${escapeHtml(labels.title)}</h1><div class="meta"><p><span class="label">${escapeHtml(labels.owner)}</span><br><span class="value">${escapeHtml(input.ownerName)}</span></p><p><span class="label">${escapeHtml(labels.timezone)}</span><br><span class="value latin">${escapeHtml(input.timezone)}</span></p><p><span class="label">${escapeHtml(labels.generated)}</span><br><span class="value latin">${escapeHtml(input.generatedAt)}</span></p></div></header>
<main><table><thead><tr><th>${escapeHtml(labels.day)}</th><th>${escapeHtml(labels.time)}</th><th>${escapeHtml(labels.duration)}</th><th>${escapeHtml(labels.student)}</th><th>${escapeHtml(labels.teacher)}</th><th>${escapeHtml(labels.track)}</th></tr></thead><tbody>${rows}</tbody></table></main>
<footer>${escapeHtml(labels.note)}</footer></body></html>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadFonts(): Promise<PdfFonts> {
  const entries = await Promise.all(
    Object.entries(fontFiles).map(async ([name, filename]) => {
      const contents = await readFile(resolve(process.cwd(), "app", "fonts", filename));
      return [name, `data:font/woff2;base64,${contents.toString("base64")}`] as const;
    }),
  );
  return Object.fromEntries(entries) as PdfFonts;
}
