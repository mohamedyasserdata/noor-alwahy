import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import { DateTime } from "luxon";
import puppeteer from "puppeteer-core";

import type { CalendarFeedRow } from "./ical";

type SchedulePdfDocument = {
  ownerName: string;
  ownerTimezone: string;
  ownerLocale: "ar" | "en";
  rows: CalendarFeedRow[];
  generatedAt: string;
};

const cairoFontRoot = join(process.cwd(), "node_modules", "@fontsource-variable", "cairo", "files");
const cairoArabicPath = join(cairoFontRoot, "cairo-arabic-wght-normal.woff2");
const cairoLatinPath = join(cairoFontRoot, "cairo-latin-wght-normal.woff2");

export async function renderSchedulePdf(document: SchedulePdfDocument) {
  const html = await createScheduleHtml(document);
  const executablePath = await resolveChromiumExecutable();
  const localRuntime = Boolean(process.env.PUPPETEER_EXECUTABLE_PATH);
  const browser = await puppeteer.launch({
    ...(localRuntime ? {} : { args: chromium.args }),
    defaultViewport: { height: 720, width: 1280 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await page.pdf({
      format: "A4",
      outline: true,
      printBackground: true,
      tagged: true,
    });
  } finally {
    await browser.close();
  }
}

export async function createScheduleHtml(document: SchedulePdfDocument) {
  const [cairoArabic, cairoLatin] = await Promise.all([
    loadFont(cairoArabicPath),
    loadFont(cairoLatinPath),
  ]);
  const isArabic = document.ownerLocale === "ar";
  const labels = isArabic
    ? {
        title: "جدول الحصص",
        owner: "صاحب الجدول",
        timezone: "المنطقة الزمنية",
        generated: "تاريخ الإصدار",
        empty: "لا توجد حصص مجدولة خلال الأيام الثمانية والعشرين القادمة.",
        student: "الطالب",
        teacher: "المدرس",
        track: "المسار",
      }
    : {
        title: "Session schedule",
        owner: "Schedule owner",
        timezone: "Time zone",
        generated: "Generated on",
        empty: "No sessions are scheduled in the next 28 days.",
        student: "Student",
        teacher: "Teacher",
        track: "Track",
      };
  const generated = formatLocal(document.generatedAt, document.ownerTimezone, document.ownerLocale);
  const events = document.rows.filter(isPdfEvent);
  const cards = events
    .map((row) => {
      const start = DateTime.fromISO(row.scheduled_at, { setZone: true }).setZone(
        document.ownerTimezone,
      );
      const end = DateTime.fromISO(row.ends_at, { setZone: true }).setZone(document.ownerTimezone);
      if (!start.isValid || !end.isValid) throw new Error("invalid_calendar_timestamp");
      const date = start.setLocale(document.ownerLocale).toLocaleString({
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const time = `${start.toFormat("HH:mm")} - ${end.toFormat("HH:mm")}`;
      const track = isArabic
        ? (row.track_name_ar ?? row.track_name_en ?? "حصة")
        : (row.track_name_en ?? row.track_name_ar ?? "Session");

      return `<article class="session">
        <div class="date"><strong>${escapeHtml(date)}</strong><span dir="ltr">${escapeHtml(time)}</span></div>
        <h2>${escapeHtml(track)}</h2>
        <dl>
          <div><dt>${labels.student}</dt><dd>${escapeHtml(row.student_name)}</dd></div>
          <div><dt>${labels.teacher}</dt><dd>${escapeHtml(row.teacher_name)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");

  return `<!doctype html><html lang="${document.ownerLocale}" dir="${isArabic ? "rtl" : "ltr"}">
  <head><meta charset="utf-8"><style>
  @font-face{font-family:Cairo;src:url('${cairoArabic}') format('woff2');font-weight:200 1000}
  @font-face{font-family:CairoLatin;src:url('${cairoLatin}') format('woff2');font-weight:200 1000}
  @page{size:A4;margin:12mm 12mm 14mm}*{box-sizing:border-box}body{margin:0;color:#102b50;background:#fff;font:10pt/1.65 Cairo,CairoLatin,sans-serif}
  header{border-block-end:1.2mm solid #d3aa45;padding-block-end:6mm;margin-block-end:7mm}.brand{color:#d3aa45;font-weight:800;font-size:10pt}.title{margin:1mm 0 0;font-size:25pt;line-height:1.3}.meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm;margin-block-start:5mm}.meta div{background:#f7f2e7;border-radius:3mm;padding:3mm}.meta span{display:block;color:#66758a;font-size:8pt}.meta strong{display:block;margin-block-start:1mm;overflow-wrap:anywhere}
  .sessions{display:grid;gap:4mm}.session{break-inside:avoid;border:.35mm solid #d7deea;border-inline-start:1.4mm solid #d3aa45;border-radius:3mm;padding:4mm 5mm}.date{display:flex;justify-content:space-between;gap:5mm;color:#66758a}.session h2{margin:2mm 0;font-size:14pt}.session dl{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:0}.session dl div{min-width:0}.session dt{color:#66758a;font-size:8pt}.session dd{margin:0;font-weight:700;overflow-wrap:anywhere}.empty{border:.35mm dashed #b8c2d1;border-radius:3mm;padding:10mm;text-align:center;color:#66758a}
  footer{margin-block-start:8mm;border-block-start:.25mm solid #e5e9ef;padding-block-start:3mm;text-align:center;color:#7b8797;font-size:7pt}
  </style></head><body><header><div class="brand">${isArabic ? "أكاديمية نور الوحي" : "Noor Al-Wahy Academy"}</div><h1 class="title">${labels.title}</h1><div class="meta"><div><span>${labels.owner}</span><strong>${escapeHtml(document.ownerName)}</strong></div><div><span>${labels.timezone}</span><strong dir="ltr">${escapeHtml(document.ownerTimezone)}</strong></div><div><span>${labels.generated}</span><strong>${escapeHtml(generated)}</strong></div></div></header><main class="sessions">${cards || `<p class="empty">${labels.empty}</p>`}</main><footer>${labels.track}: noor-alwahy</footer></body></html>`;
}

async function resolveChromiumExecutable() {
  const localExecutable = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (localExecutable) return localExecutable;

  const packUrl = process.env.CHROMIUM_PACK_URL;
  if (!packUrl) throw new Error("chromium_runtime_unavailable");
  const parsedPackUrl = new URL(packUrl);
  if (parsedPackUrl.protocol !== "https:" || parsedPackUrl.username || parsedPackUrl.password) {
    throw new Error("invalid_chromium_pack_url");
  }
  return chromium.executablePath(parsedPackUrl.toString());
}

async function loadFont(packagePath: string) {
  const content = await readFile(packagePath);
  return `data:font/woff2;base64,${content.toString("base64")}`;
}

function formatLocal(value: string, zone: string, locale: "ar" | "en") {
  const parsed = DateTime.fromISO(value, { setZone: true }).setZone(zone).setLocale(locale);
  if (!parsed.isValid) throw new Error("invalid_calendar_timestamp");
  return parsed.toLocaleString(DateTime.DATETIME_MED);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPdfEvent(row: CalendarFeedRow): row is CalendarFeedRow & {
  session_id: string;
  scheduled_at: string;
  ends_at: string;
  student_name: string;
  teacher_name: string;
} {
  return Boolean(
    row.session_id && row.scheduled_at && row.ends_at && row.student_name && row.teacher_name,
  );
}
