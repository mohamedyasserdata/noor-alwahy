import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = resolve(projectRoot, "tests/fixtures/pdf/quran-sample.json");
const sourcePage = "https://tanzil.net/download/";
const downloadUrl =
  "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&marks=true&sajdah=true&tatweel=true&agree=true";
const expectedArchiveSha256 = "6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const response = await fetch(downloadUrl, {
  headers: { "user-agent": "noor-alwahy-pdf-spike/1.0" },
});

if (!response.ok) {
  throw new Error(`Tanzil download failed with HTTP ${response.status}.`);
}

const archive = Buffer.from(await response.arrayBuffer());
const archiveSha256 = sha256(archive);

if (archiveSha256 !== expectedArchiveSha256) {
  throw new Error(
    `Tanzil archive checksum changed: expected ${expectedArchiveSha256}, received ${archiveSha256}.`,
  );
}

const verses = archive
  .toString("utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/u)
  .map((line) => /^(\d+)\|(\d+)\|(.*)$/u.exec(line))
  .filter((match) => match !== null)
  .map((match) => ({
    chapter: Number(match[1]),
    verse: Number(match[2]),
    text: match[3],
  }));

if (verses.length !== 6236) {
  throw new Error(`Expected 6236 verses, received ${verses.length}.`);
}

const sample = verses.filter(({ chapter, verse }) => chapter === 1 && verse <= 3);

if (sample.length !== 3) {
  throw new Error(`Expected three sample verses, received ${sample.length}.`);
}

const fixture = {
  source: {
    name: "Tanzil Project",
    sourcePage,
    downloadUrl,
    textType: "Uthmani",
    version: "1.1",
    snapshotDate: "2026-10-17",
    archiveSha256,
    verseCount: verses.length,
  },
  chapter: 1,
  verses: sample.map(({ chapter, verse, text }) => ({
    key: `${chapter}:${verse}`,
    text,
    sha256: sha256(text),
  })),
};

await mkdir(dirname(fixturePath), { recursive: true });
await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

process.stdout.write(
  `Wrote ${sample.length} verified verses from Tanzil 1.1 (${archiveSha256}).\n`,
);
