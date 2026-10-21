import "server-only";

import { strToU8, zipSync } from "fflate";

import { packageImportHeaders } from "@/lib/validators/package-import";

export type PackageExportCell = string | number;

export function createPackageWorkbook(rows: PackageExportCell[][], locale: "ar" | "en") {
  const data = [Array.from(packageImportHeaders), ...rows];
  const instructions =
    locale === "ar"
      ? [
          ["تعليمات قالب الباقات"],
          ["كل صف يمثل سعر دولة واحدة. كرر بيانات الباقة نفسها عند إضافة دولة أخرى."],
          ["استخدم true أو false في حقول الحالة، وافصل المميزات بعلامة | دون صيغ Excel."],
          ["يجب وجود صف ZZ بسعر افتراضي نشط قبل نشر الباقة."],
        ]
      : [
          ["Package workbook instructions"],
          [
            "Each row represents one country price. Repeat identical package fields for additional countries.",
          ],
          [
            "Use true or false for status fields, separate features with |, and do not add formulas.",
          ],
          ["A published package must include an active ZZ fallback price row."],
        ];
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Packages" sheetId="1" r:id="rId1"/><sheet name="Instructions" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": xml(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": xml(stylesXml()),
    "xl/worksheets/sheet1.xml": xml(sheetXml(data, true, locale === "ar")),
    "xl/worksheets/sheet2.xml": xml(sheetXml(instructions, false, locale === "ar")),
  };
  return zipSync(files, { level: 6 });
}

export function createPackageCsv(rows: PackageExportCell[][]) {
  return `\uFEFF${[Array.from(packageImportHeaders), ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\r\n")}`;
}

function sheetXml(rows: PackageExportCell[][], tabular: boolean, rtl: boolean) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => cellXml(value, columnIndex, rowIndex)).join("");
      return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="28" customHeight="1"' : ""}>${cells}</row>`;
    })
    .join("");
  const endColumn = columnName(Math.max(0, (rows[0]?.length ?? 1) - 1));
  const widths = tabular
    ? `<cols>${Array.from({ length: packageImportHeaders.length }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index < 5 ? 24 : index === 11 || index === 12 ? 28 : 16}" customWidth="1"/>`).join("")}</cols>`
    : '<cols><col min="1" max="1" width="90" customWidth="1"/></cols>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="${rtl ? 1 : 0}">${tabular ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews>${widths}<sheetData>${body}</sheetData>${tabular ? `<autoFilter ref="A1:${endColumn}${Math.max(1, rows.length)}"/>` : ""}</worksheet>`;
}

function cellXml(value: PackageExportCell, column: number, row: number) {
  const reference = `${columnName(column)}${row + 1}`;
  const style = row === 0 ? 1 : 2;
  if (typeof value === "number" && Number.isFinite(value))
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0C2D57"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFD6B24C"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs></styleSheet>`;
}

function csvCell(value: PackageExportCell) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
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
function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
function xml(value: string) {
  return strToU8(value);
}
