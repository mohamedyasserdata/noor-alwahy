import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import { strToU8, zipSync } from "fflate";
import puppeteer from "puppeteer-core";

export type PayoutExportDocument = {
  locale: "ar" | "en";
  payoutNo: string;
  teacher: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  gross: number;
  bonuses: number;
  deductions: number;
  net: number;
  status: string;
  items: Array<{ date: string; kind: string; rate: number; amount: number }>;
  adjustments: Array<{ kind: string; amount: number; reason: string }>;
};

export function createPayoutWorkbook(document: PayoutExportDocument) {
  const ar = document.locale === "ar";
  const rows: Array<Array<string | number>> = [
    ar
      ? ["التاريخ", "النوع", "المعدل المثبت", "المبلغ", "العملة"]
      : ["Date", "Type", "Rate snapshot", "Amount", "Currency"],
    ...document.items.map((item) => [
      item.date,
      item.kind,
      item.rate,
      item.amount,
      document.currency,
    ]),
    [],
    [ar ? "الإجمالي" : "Gross", "", "", document.gross, document.currency],
    [ar ? "المكافآت" : "Bonuses", "", "", document.bonuses, document.currency],
    [ar ? "الخصومات" : "Deductions", "", "", document.deductions, document.currency],
    [ar ? "الصافي" : "Net", "", "", document.net, document.currency],
  ];
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
    "_rels/.rels": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Payout" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    "xl/styles.xml": xml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0C2D57"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>',
    ),
    "xl/worksheets/sheet1.xml": xml(sheet(rows, ar)),
  };
  return zipSync(files, { level: 6 });
}

export async function renderPayoutPdf(document: PayoutExportDocument) {
  const ar = document.locale === "ar";
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
    ? {
        title: "كشف أجر المدرس",
        teacher: "المدرس",
        period: "الفترة",
        date: "التاريخ",
        kind: "النوع",
        rate: "المعدل المثبت",
        amount: "المبلغ",
        gross: "إجمالي الحصص",
        bonuses: "المكافآت",
        deductions: "الخصومات",
        net: "الصافي",
      }
    : {
        title: "Teacher payout statement",
        teacher: "Teacher",
        period: "Period",
        date: "Date",
        kind: "Type",
        rate: "Rate snapshot",
        amount: "Amount",
        gross: "Gross",
        bonuses: "Bonuses",
        deductions: "Deductions",
        net: "Net pay",
      };
  const rows = document.items
    .map(
      (item) =>
        `<tr><td>${escape(item.date)}</td><td>${escape(item.kind)}</td><td>${item.rate.toFixed(2)}</td><td>${item.amount.toFixed(2)} ${escape(document.currency)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="${document.locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>@font-face{font-family:Cairo;src:url('${font}')}@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:10.5pt/1.7 Cairo,Arial;color:#102b50}header{background:#102b50;color:white;border-radius:5mm;padding:7mm}h1{margin:0;color:#d3aa45}.meta{display:grid;grid-template-columns:2fr 1fr;gap:4mm;margin-top:4mm}table{width:100%;border-collapse:collapse;margin-top:7mm}th{background:#102b50;color:#fff}th,td{border:.3mm solid #d9dfe8;padding:2.5mm;text-align:${ar ? "right" : "left"}}td:nth-child(n+3){direction:ltr}.totals{margin-top:6mm;margin-inline-start:auto;width:70mm}.totals div{display:flex;justify-content:space-between;border-bottom:.3mm solid #d9dfe8;padding:2mm}.totals div:last-child{background:#f7efd8;font-weight:bold;font-size:13pt}</style></head><body><header><h1>${labels.title}</h1><div>${escape(document.payoutNo)} · ${escape(document.status)}</div></header><div class="meta"><p><b>${labels.teacher}:</b> ${escape(document.teacher)}</p><p><b>${labels.period}:</b> ${escape(document.periodStart)} — ${escape(document.periodEnd)}</p></div><table><thead><tr><th>${labels.date}</th><th>${labels.kind}</th><th>${labels.rate}</th><th>${labels.amount}</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>${labels.gross}</span><b>${document.gross.toFixed(2)}</b></div><div><span>${labels.bonuses}</span><b>${document.bonuses.toFixed(2)}</b></div><div><span>${labels.deductions}</span><b>${document.deductions.toFixed(2)}</b></div><div><span>${labels.net}</span><b>${document.net.toFixed(2)} ${escape(document.currency)}</b></div></div></body></html>`;
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? {} : { args: chromium.args }),
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await page.pdf({ format: "A4", printBackground: true, tagged: true });
  } finally {
    await browser.close();
  }
}

function sheet(rows: Array<Array<string | number>>, rtl: boolean) {
  const body = rows
    .map(
      (row, y) =>
        `<row r="${y + 1}">${row
          .map((value, x) => {
            const ref = `${String.fromCharCode(65 + x)}${y + 1}`;
            return typeof value === "number"
              ? `<c r="${ref}" s="2"><v>${value}</v></c>`
              : `<c r="${ref}" s="${y === 0 ? 1 : 0}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="${rtl ? 1 : 0}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="5" width="22" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`;
}
function xml(value: string) {
  return strToU8(value);
}
function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
