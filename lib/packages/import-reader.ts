import "server-only";

import { strFromU8, unzipSync } from "fflate";

import { packageImportHeaders } from "@/lib/validators/package-import";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 1000;

export async function readPackageImportFile(file: File): Promise<string[][]> {
  if (file.size === 0 || file.size > MAX_FILE_BYTES) throw new Error("invalid_file");
  const extension = file.name.toLowerCase().split(".").pop();
  let matrix: string[][];
  if (extension === "csv") {
    matrix = parseCsv(await file.text());
  } else if (extension === "xlsx") {
    matrix = parseXlsx(new Uint8Array(await file.arrayBuffer()));
  } else {
    throw new Error("invalid_file");
  }

  const headers = matrix[0] ?? [];
  if (
    packageImportHeaders.some((header, index) => headers[index]?.trim() !== header) ||
    headers.length !== packageImportHeaders.length
  ) {
    throw new Error("invalid_headers");
  }
  const rows = matrix.slice(1).filter((row) => row.some((value) => value.trim() !== ""));
  if (rows.length === 0 || rows.length > MAX_ROWS) throw new Error("invalid_row_count");
  return rows;
}

function parseXlsx(bytes: Uint8Array) {
  assertSafeZip(bytes);
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch {
    throw new Error("invalid_file");
  }
  if (Object.keys(archive).some((name) => /vbaProject|externalLinks|embeddings/i.test(name))) {
    throw new Error("unsafe_workbook");
  }
  const workbookXml = textEntry(archive, "xl/workbook.xml");
  const relationshipsXml = textEntry(archive, "xl/_rels/workbook.xml.rels");
  const sheetMatch = [...workbookXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?\s*>/g)].find(
    (match) => attribute(match[1] ?? "", "name") === "Packages",
  );
  const relationId = sheetMatch ? attribute(sheetMatch[1] ?? "", "r:id") : null;
  if (!relationId) throw new Error("missing_packages_sheet");
  const relationship = [...relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].find(
    (match) => attribute(match[1] ?? "", "Id") === relationId,
  );
  const target = relationship ? attribute(relationship[1] ?? "", "Target") : null;
  if (!target || target.includes("..")) throw new Error("invalid_file");
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const sheetXml = textEntry(archive, sheetPath.replaceAll("\\", "/"));
  if (/<(?:\w+:)?f(?:\s|>)/i.test(sheetXml)) throw new Error("formulas_not_allowed");
  const shared = archive["xl/sharedStrings.xml"]
    ? parseSharedStrings(strFromU8(archive["xl/sharedStrings.xml"]))
    : [];
  return parseSheet(sheetXml, shared);
}

function parseCsv(source: string) {
  if (source.includes("\0")) throw new Error("invalid_file");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted && character === '"' && source[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      row.push(value);
      value = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      if (rows.length > MAX_ROWS + 1) throw new Error("invalid_row_count");
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("invalid_file");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  if (rows[0]?.[0]?.charCodeAt(0) === 0xfeff) rows[0][0] = rows[0][0].slice(1);
  return rows.map((cells) => cells.map((cell) => (/^'[=+\-@]/.test(cell) ? cell.slice(1) : cell)));
}

function assertSafeZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65_557) && view.getUint32(end, true) !== 0x06054b50)
    end -= 1;
  if (end < 0) throw new Error("invalid_file");
  const entries = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  let cursor = view.getUint32(end + 16, true);
  if (entries > 120 || centralSize > bytes.length || cursor + centralSize > bytes.length)
    throw new Error("unsafe_workbook");
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("invalid_file");
    total += view.getUint32(cursor + 24, true);
    if (total > MAX_UNCOMPRESSED_BYTES) throw new Error("unsafe_workbook");
    cursor +=
      46 +
      view.getUint16(cursor + 28, true) +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true);
  }
}

function parseSharedStrings(xml: string) {
  return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((match) =>
    extractText(match[1] ?? ""),
  );
}

function parseSheet(xml: string, shared: string[]) {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const rowNumber = Number(attribute(rowMatch[1] ?? "", "r") ?? rows.length + 1);
    if (rowNumber > MAX_ROWS + 1) throw new Error("invalid_row_count");
    const row: string[] = [];
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(
      /<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g,
    )) {
      const attributes = cellMatch[1] ?? "";
      const column = columnIndex((attribute(attributes, "r") ?? "A1").replace(/\d+$/, ""));
      if (column >= packageImportHeaders.length) continue;
      const body = cellMatch[2] ?? "";
      const raw = body.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? "";
      let value = attribute(attributes, "t") === "inlineStr" ? extractText(body) : decodeXml(raw);
      if (attribute(attributes, "t") === "s") value = shared[Number(value)] ?? "";
      row[column] = value;
    }
    rows[rowNumber - 1] = row;
  }
  return rows;
}

function textEntry(archive: Record<string, Uint8Array>, name: string) {
  const entry = archive[name];
  if (!entry) throw new Error("invalid_file");
  return strFromU8(entry);
}
function attribute(source: string, name: string) {
  return source.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? null;
}
function extractText(xml: string) {
  return [...xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
    .map((match) => decodeXml(match[1] ?? ""))
    .join("");
}
function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}
function columnIndex(letters: string) {
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}
