import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import { strToU8, zipSync } from "fflate";
import puppeteer from "puppeteer-core";

import {
  reportColumnLabel,
  type AdvancedReportResponse,
  type AdvancedReportType,
} from "@/lib/control-center/advanced-report-schema";

type ExportSnapshot = {
  reportType: AdvancedReportType;
  locale: "ar" | "en";
  timezone: string;
  columns: string[];
  filters: Record<string, unknown>;
  generatedAt: string;
};

export async function renderAdvancedReportPdf(
  report: AdvancedReportResponse,
  snapshot: ExportSnapshot,
) {
  const html = await reportHtml(report, snapshot);
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
      landscape: snapshot.columns.length > 5,
      printBackground: true,
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font:9px Arial;width:100%;text-align:center;color:#64748b"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "12mm", bottom: "16mm", left: "10mm", right: "10mm" },
    });
  } finally {
    await browser.close();
  }
}

export function createAdvancedReportWorkbook(
  report: AdvancedReportResponse,
  snapshot: ExportSnapshot,
) {
  const rows: Array<Array<string | number | null>> = [
    snapshot.columns.map((column) => reportColumnLabel(column, snapshot.locale)),
    ...report.rows.map((row) => snapshot.columns.map((column) => scalar(row[column]))),
  ];
  const meta: Array<Array<string | number | null>> = [
    [label(snapshot.locale, "الحقل", "Field"), label(snapshot.locale, "القيمة", "Value")],
    [label(snapshot.locale, "نوع التقرير", "Report type"), snapshot.reportType],
    [label(snapshot.locale, "وقت الإنشاء", "Generated at"), snapshot.generatedAt],
    [label(snapshot.locale, "المنطقة الزمنية", "Time zone"), snapshot.timezone],
    [label(snapshot.locale, "عدد الصفوف", "Rows"), report.total],
    ...Object.entries(snapshot.filters).map(([key, value]) => [key, scalar(value)]),
  ];
  const money: Array<Array<string | number | null>> = [
    [
      label(snapshot.locale, "العملة", "Currency"),
      label(snapshot.locale, "الإجمالي", "Total"),
      label(snapshot.locale, "المدفوع", "Paid"),
      label(snapshot.locale, "المتبقي", "Outstanding"),
    ],
    ...report.currency_totals.map((item) => [
      item.currency,
      item.total,
      item.paid,
      item.outstanding,
    ]),
  ];
  return workbook(
    [
      { name: "Report", rows },
      { name: "Filters", rows: meta },
      ...(report.currency_totals.length ? [{ name: "Currencies", rows: money }] : []),
    ],
    snapshot.locale === "ar",
  );
}

async function reportHtml(report: AdvancedReportResponse, snapshot: ExportSnapshot) {
  const ar = snapshot.locale === "ar";
  const fontPath = join(
    process.cwd(),
    "node_modules",
    "@fontsource-variable",
    "cairo",
    "files",
    ar ? "cairo-arabic-wght-normal.woff2" : "cairo-latin-wght-normal.woff2",
  );
  const font = `data:font/woff2;base64,${(await readFile(fontPath)).toString("base64")}`;
  const headings = snapshot.columns.map((column) => reportColumnLabel(column, snapshot.locale));
  const filters = Object.entries(snapshot.filters)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(String(value))}</span>`)
    .join("");
  return `<!doctype html><html lang="${snapshot.locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Cairo;src:url('${font}')}*{box-sizing:border-box}body{margin:0;font:8.5pt/1.55 Cairo,Arial;color:#102b50}header{background:#102b50;color:white;border-radius:4mm;padding:7mm}h1{margin:0;color:#d3aa45;font-size:20pt}.meta{display:flex;flex-wrap:wrap;gap:2mm 5mm;margin-top:3mm}.meta span{background:#fff1;border-radius:3mm;padding:1mm 2.5mm}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:6mm}thead{display:table-header-group}tr{break-inside:avoid}th{background:#102b50;color:white}th,td{border:.25mm solid #d7dee8;padding:1.8mm;text-align:start;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f8fafc}.empty{text-align:center;padding:12mm;color:#64748b}.totals{margin-top:5mm;break-inside:avoid}.totals h2{font-size:12pt}.totals table{margin-top:2mm}
  </style></head><body><header><h1>${escapeHtml(reportTitle(snapshot.reportType, snapshot.locale))}</h1><div class="meta"><span>${label(snapshot.locale, "أُنشئ", "Generated")}: ${escapeHtml(snapshot.generatedAt)}</span><span>${label(snapshot.locale, "المنطقة", "Time zone")}: ${escapeHtml(snapshot.timezone)}</span><span>${label(snapshot.locale, "الصفوف", "Rows")}: ${report.total}</span>${filters}</div></header>${report.rows.length ? `<table><thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${report.rows.map((row) => `<tr>${snapshot.columns.map((column) => `<td>${escapeHtml(displayValue(row[column], snapshot.locale, snapshot.timezone))}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<p class="empty">${label(snapshot.locale, "لا توجد صفوف مطابقة.", "No matching rows.")}</p>`}${currencyTotals(report, snapshot.locale)}</body></html>`;
}

function currencyTotals(report: AdvancedReportResponse, locale: "ar" | "en") {
  if (!report.currency_totals.length) return "";
  return `<section class="totals"><h2>${label(locale, "الإجماليات حسب العملة", "Totals by currency")}</h2><table><thead><tr><th>${label(locale, "العملة", "Currency")}</th><th>${label(locale, "الإجمالي", "Total")}</th><th>${label(locale, "المدفوع", "Paid")}</th><th>${label(locale, "المتبقي", "Outstanding")}</th></tr></thead><tbody>${report.currency_totals.map((item) => `<tr><td>${escapeHtml(item.currency)}</td><td>${item.total}</td><td>${item.paid}</td><td>${item.outstanding}</td></tr>`).join("")}</tbody></table></section>`;
}

function reportTitle(type: AdvancedReportType, locale: "ar" | "en") {
  const titles: Record<AdvancedReportType, [string, string]> = {
    students: ["تقرير الطلاب المتقدم", "Advanced students report"],
    sessions: ["تقرير الحصص المتقدم", "Advanced sessions report"],
    finance: ["التقرير المالي المتقدم", "Advanced finance report"],
    interventions: ["تقرير حالات التدخل", "Intervention cases report"],
  };
  return titles[type][locale === "ar" ? 0 : 1];
}

function displayValue(value: unknown, locale: "ar" | "en", timezone: string) {
  if (value == null || value === "") return "-";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  }
  return String(value).replaceAll("_", " ");
}

function scalar(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

type Sheet = { name: string; rows: Array<Array<string | number | null>> };
function workbook(sheets: Sheet[], rtl: boolean) {
  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  const entries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  const relationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${entries}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF102B50"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>',
    ),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = xml(sheetXml(sheet.rows, rtl));
  });
  return zipSync(files, { level: 6 });
}

function sheetXml(rows: Sheet["rows"], rtl: boolean) {
  const maxColumns = Math.max(...rows.map((row) => row.length), 1);
  const body = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => cellXml(value, columnIndex, rowIndex)).join("")}</row>`,
    )
    .join("");
  const widths = Array.from(
    { length: maxColumns },
    (_, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${index < 2 ? 28 : 18}" customWidth="1"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="${rtl ? 1 : 0}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${columnName(maxColumns - 1)}${Math.max(rows.length, 1)}"/></worksheet>`;
}

function cellXml(value: string | number | null, column: number, row: number) {
  const reference = `${columnName(column)}${row + 1}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" s="${row === 0 ? 1 : 2}"><v>${value}</v></c>`;
  }
  const safe = value == null ? "" : protectFormula(String(value));
  return `<c r="${reference}" s="${row === 0 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(safe)}</t></is></c>`;
}

function protectFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function escapeXml(value: string) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}
function xml(value: string) {
  return strToU8(value);
}
function label(locale: "ar" | "en", ar: string, en: string) {
  return locale === "ar" ? ar : en;
}
