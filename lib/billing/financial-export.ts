import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import { strToU8, zipSync } from "fflate";
import puppeteer from "puppeteer-core";

export type FinancialSummaryRow = {
  currency: string;
  invoiced: number;
  received: number;
  refunded: number;
  expenses: number;
  outstanding: number;
  netCash: number;
};

export function createFinancialWorkbook(rows: FinancialSummaryRow[], locale: "ar" | "en") {
  const ar = locale === "ar";
  const headings = ar
    ? ["العملة", "الفواتير", "المحصل", "المسترد", "المصروفات", "المستحق", "صافي النقدية"]
    : ["Currency", "Invoiced", "Received", "Refunded", "Expenses", "Outstanding", "Net cash"];
  const data: Array<Array<string | number>> = [
    headings,
    ...rows.map((row) => [
      row.currency,
      row.invoiced,
      row.received,
      row.refunded,
      row.expenses,
      row.outstanding,
      row.netCash,
    ]),
  ];
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
    "_rels/.rels": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Financial Summary" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    "xl/styles.xml": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0C2D57"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>',
    ),
    "xl/worksheets/sheet1.xml": xml(sheet(data, ar)),
  };
  return zipSync(files, { level: 6 });
}

export async function renderFinancialPdf(
  rows: FinancialSummaryRow[],
  locale: "ar" | "en",
  generatedAt: string,
) {
  const html = await financialHtml(rows, locale, generatedAt);
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? {} : { args: chromium.args }),
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await page.pdf({ format: "A4", landscape: true, printBackground: true, tagged: true });
  } finally {
    await browser.close();
  }
}

async function financialHtml(
  rows: FinancialSummaryRow[],
  locale: "ar" | "en",
  generatedAt: string,
) {
  const ar = locale === "ar";
  const fontPath = join(
    process.cwd(),
    "node_modules",
    "@fontsource-variable",
    "cairo",
    "files",
    ar ? "cairo-arabic-wght-normal.woff2" : "cairo-latin-wght-normal.woff2",
  );
  const font = `data:font/woff2;base64,${(await readFile(fontPath)).toString("base64")}`;
  const labels = ar
    ? ["العملة", "الفواتير", "المحصل", "المسترد", "المصروفات", "المستحق", "صافي النقدية"]
    : ["Currency", "Invoiced", "Received", "Refunded", "Expenses", "Outstanding", "Net cash"];
  const body = rows
    .map(
      (row) =>
        `<tr>${[row.currency, row.invoiced, row.received, row.refunded, row.expenses, row.outstanding, row.netCash].map((value) => `<td>${escapeHtml(String(value))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html lang="${locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>@font-face{font-family:Cairo;src:url('${font}')}@page{size:A4 landscape;margin:14mm}*{box-sizing:border-box}body{font:11pt/1.7 Cairo,Arial;color:#102b50}header{background:#102b50;color:white;border-radius:5mm;padding:8mm}h1{margin:0;color:#d3aa45}p{margin:2mm 0 0}table{width:100%;border-collapse:collapse;margin-top:8mm}th{background:#102b50;color:white}th,td{border:.3mm solid #d9dfe8;padding:3mm;text-align:${ar ? "right" : "left"}}td:not(:first-child){direction:ltr;font-variant-numeric:tabular-nums}</style></head><body><header><h1>${ar ? "التقرير المالي حسب العملة" : "Financial report by currency"}</h1><p>${ar ? "أكاديمية نور الوحي" : "Noor Al-Wahy Academy"} · ${escapeHtml(generatedAt)}</p></header><table><thead><tr>${labels.map((label) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function sheet(rows: Array<Array<string | number>>, rtl: boolean) {
  const body = rows
    .map(
      (row, y) =>
        `<row r="${y + 1}">${row
          .map((value, x) => {
            const ref = `${column(x)}${y + 1}`;
            return typeof value === "number"
              ? `<c r="${ref}" s="${y ? 2 : 1}"><v>${value}</v></c>`
              : `<c r="${ref}" s="${y ? 0 : 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="${rtl ? 1 : 0}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="7" width="19" customWidth="1"/></cols><sheetData>${body}</sheetData><autoFilter ref="A1:G${Math.max(1, rows.length)}"/></worksheet>`;
}
function column(index: number) {
  return String.fromCharCode(65 + index);
}
function xml(value: string) {
  return strToU8(value);
}
function escapeXml(value: string) {
  return escapeHtml(value).replaceAll("'", "&apos;").replaceAll('"', "&quot;");
}
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
