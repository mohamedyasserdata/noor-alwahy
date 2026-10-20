import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const TEXT_URL =
  "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&marks=true&sajdah=true&tatweel=true&agree=true";
const METADATA_URL = "https://tanzil.net/res/text/metadata/quran-data.xml";
const TEXT_SHA256 = "6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f";
const METADATA_SHA256 = "8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a";

type Attributes = Record<string, string>;
type Surah = {
  id: number;
  start: number;
  ayahCount: number;
  nameAr: string;
  nameEn: string;
  revelation: "meccan" | "medinan";
};
type Boundary = { index: number; ayahId: number };
type Ayah = {
  id: number;
  surahId: number;
  ayahNo: number;
  page: number;
  juz: number;
  hizbQuarter: number;
  text: string;
};

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeXml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function parseAttributes(source: string): Attributes {
  return Object.fromEntries(
    [...source.matchAll(/([a-z]+)="([^"]*)"/giu)].map((match) => [
      match[1] ?? "",
      decodeXml(match[2] ?? ""),
    ]),
  );
}

function requireInteger(attributes: Attributes, name: string) {
  const value = Number(attributes[name]);
  if (!Number.isInteger(value)) {
    throw new Error(`Tanzil metadata has an invalid ${name} value.`);
  }
  return value;
}

function requireText(attributes: Attributes, name: string) {
  const value = attributes[name];
  if (!value) {
    throw new Error(`Tanzil metadata is missing ${name}.`);
  }
  return value;
}

function parseTags(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\s+([^>]+?)\\s*/>`, "giu");
  return [...xml.matchAll(pattern)].map((match) => parseAttributes(match[1] ?? ""));
}

function parseSurahs(xml: string): Surah[] {
  return parseTags(xml, "sura").map((attributes) => {
    const type = requireText(attributes, "type").toLowerCase();
    if (type !== "meccan" && type !== "medinan") {
      throw new Error(`Unexpected revelation type: ${type}.`);
    }
    return {
      id: requireInteger(attributes, "index"),
      start: requireInteger(attributes, "start"),
      ayahCount: requireInteger(attributes, "ayas"),
      nameAr: requireText(attributes, "name"),
      nameEn: requireText(attributes, "ename"),
      revelation: type,
    };
  });
}

function parseBoundaries(xml: string, tag: string, surahs: Map<number, Surah>) {
  return parseTags(xml, tag).map((attributes): Boundary => {
    const surah = surahs.get(requireInteger(attributes, "sura"));
    if (!surah) {
      throw new Error(`${tag} boundary refers to an unknown surah.`);
    }
    return {
      index: requireInteger(attributes, "index"),
      ayahId: surah.start + requireInteger(attributes, "aya"),
    };
  });
}

function boundaryAt(boundaries: Boundary[], ayahId: number) {
  let current = boundaries[0];
  if (!current) throw new Error("Tanzil metadata has no partition boundaries.");
  for (const boundary of boundaries) {
    if (boundary.ayahId > ayahId) break;
    current = boundary;
  }
  return current.index;
}

function parseAyahs(text: string, surahs: Surah[], xml: string): Ayah[] {
  const surahById = new Map(surahs.map((surah) => [surah.id, surah]));
  const pages = parseBoundaries(xml, "page", surahById);
  const juz = parseBoundaries(xml, "juz", surahById);
  const quarters = parseBoundaries(xml, "quarter", surahById);

  return text
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => /^(\d+)\|(\d+)\|(.*)$/u.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match, offset) => {
      const surahId = Number(match[1]);
      const ayahNo = Number(match[2]);
      const surah = surahById.get(surahId);
      const ayahText = match[3] ?? "";
      if (!surah || ayahNo < 1 || ayahNo > surah.ayahCount || ayahText.length === 0) {
        throw new Error(`Invalid Tanzil ayah record at imported row ${offset + 1}.`);
      }
      const id = offset + 1;
      if (id !== surah.start + ayahNo) {
        throw new Error(`Non-canonical ayah sequence at ${surahId}:${ayahNo}.`);
      }
      return {
        id,
        surahId,
        ayahNo,
        page: boundaryAt(pages, id),
        juz: boundaryAt(juz, id),
        hizbQuarter: boundaryAt(quarters, id),
        text: ayahText,
      };
    });
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function valuesSql(rows: string[], size = 500) {
  const statements: string[] = [];
  for (let offset = 0; offset < rows.length; offset += size) {
    statements.push(rows.slice(offset, offset + size).join(",\n"));
  }
  return statements;
}

function buildSql(surahs: Surah[], ayahs: Ayah[]) {
  const pageRows = new Map<number, { first: number; last: number; juz: number }>();
  for (const ayah of ayahs) {
    const page = pageRows.get(ayah.page);
    if (page) page.last = ayah.id;
    else pageRows.set(ayah.page, { first: ayah.id, last: ayah.id, juz: ayah.juz });
  }

  const surahValues = surahs.map(
    (surah) =>
      `(${surah.id}, ${sqlString(surah.nameAr)}, ${sqlString(surah.nameEn)}, ${surah.ayahCount}, ${sqlString(surah.revelation)})`,
  );
  const ayahValues = ayahs.map(
    (ayah) =>
      `(${ayah.id}, ${ayah.surahId}, ${ayah.ayahNo}, ${ayah.page}, ${ayah.juz}, ${ayah.hizbQuarter}, ${sqlString(ayah.text)})`,
  );
  const pageValues = [...pageRows].map(
    ([page, range]) => `(${page}, ${range.juz}, ${range.first}, ${range.last})`,
  );
  const ayahInserts = valuesSql(ayahValues).map(
    (values) =>
      `insert into public.quran_ayahs (id, surah_id, ayah_no, page, juz, hizb_quarter, text_uthmani) values\n${values};`,
  );

  return `-- Generated by scripts/import-quran.ts from checksum-pinned Tanzil Project files.
-- Quran text copyright notice: CC BY 3.0; verbatim copying is permitted, changes are prohibited.
-- Source and updates: https://tanzil.net/ and https://tanzil.net/updates/

create table public.quran_surahs (
  id smallint primary key check (id between 1 and 114),
  name_ar text not null,
  name_en text not null,
  ayah_count smallint not null check (ayah_count > 0),
  revelation text not null check (revelation in ('meccan', 'medinan'))
);

create table public.quran_ayahs (
  id integer primary key check (id between 1 and 6236),
  surah_id smallint not null references public.quran_surahs(id),
  ayah_no smallint not null check (ayah_no > 0),
  page smallint not null check (page between 1 and 604),
  juz smallint not null check (juz between 1 and 30),
  hizb_quarter smallint not null check (hizb_quarter between 1 and 240),
  text_uthmani text not null check (text_uthmani <> ''),
  unique (surah_id, ayah_no)
);

create index quran_ayahs_page_id_idx on public.quran_ayahs (page, id);
create index quran_ayahs_juz_id_idx on public.quran_ayahs (juz, id);

create table public.quran_pages (
  page smallint primary key check (page between 1 and 604),
  juz smallint not null check (juz between 1 and 30),
  first_ayah_id integer not null references public.quran_ayahs(id),
  last_ayah_id integer not null references public.quran_ayahs(id),
  lines_count smallint check (lines_count > 0),
  check (first_ayah_id <= last_ayah_id)
);

create table public.quran_dataset_meta (
  id smallint primary key default 1 check (id = 1),
  source text not null,
  source_url text not null,
  version text not null,
  metadata_version text not null,
  license text not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  metadata_checksum_sha256 text not null check (metadata_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz not null default now()
);

insert into public.quran_surahs (id, name_ar, name_en, ayah_count, revelation) values
${surahValues.join(",\n")};

${ayahInserts.join("\n\n")}

insert into public.quran_pages (page, juz, first_ayah_id, last_ayah_id) values
${pageValues.join(",\n")};

insert into public.quran_dataset_meta (
  id, source, source_url, version, metadata_version, license,
  checksum_sha256, metadata_checksum_sha256
) values (
  1,
  'Tanzil Project',
  'https://tanzil.net/',
  '1.1',
  '1.0',
  'CC BY 3.0 — verbatim text; attribution required; changes prohibited',
  '${TEXT_SHA256}',
  '${METADATA_SHA256}'
);

alter table public.quran_surahs enable row level security;
alter table public.quran_ayahs enable row level security;
alter table public.quran_pages enable row level security;
alter table public.quran_dataset_meta enable row level security;

create policy quran_surahs_read on public.quran_surahs for select to anon, authenticated using (true);
create policy quran_ayahs_read on public.quran_ayahs for select to anon, authenticated using (true);
create policy quran_pages_read on public.quran_pages for select to anon, authenticated using (true);
create policy quran_dataset_meta_read on public.quran_dataset_meta for select to anon, authenticated using (true);

revoke all on table public.quran_surahs, public.quran_ayahs, public.quran_pages, public.quran_dataset_meta
  from public, anon, authenticated, service_role;
grant select on table public.quran_surahs, public.quran_ayahs, public.quran_pages, public.quran_dataset_meta
  to anon, authenticated, service_role;
`;
}

async function fetchVerified(url: string, expectedHash: string, label: string) {
  const response = await fetch(url, { headers: { "user-agent": "noor-alwahy-quran-import/1.0" } });
  if (!response.ok) throw new Error(`${label} download failed with HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actualHash = sha256(bytes);
  if (actualHash !== expectedHash) {
    throw new Error(
      `${label} checksum mismatch: expected ${expectedHash}, received ${actualHash}.`,
    );
  }
  return new TextDecoder().decode(bytes);
}

async function main() {
  const outputArgument = process.argv.slice(2).find((argument) => argument !== "--");
  if (!outputArgument) {
    throw new Error("Usage: pnpm quran:import -- <empty migration.sql>");
  }
  const outputPath = resolve(outputArgument);
  const outputStat = await stat(outputPath);
  if (!outputStat.isFile() || (await readFile(outputPath, "utf8")).trim() !== "") {
    throw new Error("The output must be an existing empty migration created by the Supabase CLI.");
  }

  const [text, xml] = await Promise.all([
    fetchVerified(TEXT_URL, TEXT_SHA256, "Tanzil text"),
    fetchVerified(METADATA_URL, METADATA_SHA256, "Tanzil metadata"),
  ]);
  const surahs = parseSurahs(xml);
  const ayahs = parseAyahs(text, surahs, xml);
  if (surahs.length !== 114 || ayahs.length !== 6236) {
    throw new Error(
      `Dataset shape mismatch: received ${surahs.length} surahs and ${ayahs.length} ayahs.`,
    );
  }
  if (surahs.reduce((sum, surah) => sum + surah.ayahCount, 0) !== ayahs.length) {
    throw new Error("Surah ayah counts do not match the verified text.");
  }

  await writeFile(outputPath, buildSql(surahs, ayahs), "utf8");
  process.stdout.write(
    `Generated verified Quran migration with ${surahs.length} surahs and ${ayahs.length} ayahs.\n`,
  );
}

await main();
