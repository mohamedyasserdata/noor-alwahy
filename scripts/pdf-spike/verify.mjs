import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import jsQR from "jsqr";
import { PNG } from "pngjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(projectRoot, "output/pdf");
const renderDir = resolve(projectRoot, "tmp/pdfs/rendered");
const baselinePath = resolve(projectRoot, "tests/fixtures/pdf/baselines/certificate-chromium.png");
const fixture = JSON.parse(
  await readFile(resolve(projectRoot, "tests/fixtures/pdf/certificate-content.json"), "utf8"),
);
const pdfs = [
  { engine: "chromium", path: resolve(outputDir, "certificate-chromium.pdf") },
  { engine: "react-pdf", path: resolve(outputDir, "certificate-react-pdf.pdf") },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: options.encoding ?? "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? "utf-8",
    },
  });

  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

function normalizeText(value) {
  return value.normalize("NFKC").replaceAll("\u0000", "").replaceAll(/\s+/gu, " ").trim();
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function isA4Landscape(info) {
  const match = /Page size:\s+([\d.]+) x ([\d.]+) pts \(A4\)/u.exec(info);
  if (!match) return false;

  const width = Number(match[1]);
  const height = Number(match[2]);
  return Math.abs(width - 841.89) <= 1 && Math.abs(height - 595.28) <= 1;
}

function decodeQr(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
    inversionAttempts: "dontInvert",
  });
  return decoded?.data ?? null;
}

function comparePng(actualBuffer, baselineBuffer) {
  const actual = PNG.sync.read(actualBuffer);
  const baseline = PNG.sync.read(baselineBuffer);

  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return { ratio: 1, sameDimensions: false };
  }

  let differentPixels = 0;
  for (let index = 0; index < actual.data.length; index += 4) {
    const delta =
      Math.abs(actual.data[index] - baseline.data[index]) +
      Math.abs(actual.data[index + 1] - baseline.data[index + 1]) +
      Math.abs(actual.data[index + 2] - baseline.data[index + 2]);
    if (delta > 24) differentPixels += 1;
  }

  return {
    ratio: differentPixels / (actual.width * actual.height),
    sameDimensions: true,
  };
}

await mkdir(renderDir, { recursive: true });

const inspectionRaw = run(process.env.PDF_SPIKE_PYTHON ?? "python3", [
  resolve(projectRoot, "scripts/pdf-spike/inspect_pdf.py"),
  ...pdfs.map(({ path }) => path),
]);
const inspections = JSON.parse(inspectionRaw);
const results = [];

for (const [index, pdf] of pdfs.entries()) {
  const info = run("pdfinfo", [pdf.path]);
  const renderPrefix = resolve(renderDir, pdf.engine);
  run("pdftoppm", ["-f", "1", "-singlefile", "-r", "180", "-png", pdf.path, renderPrefix]);

  const extractedText = normalizeText(inspections[index].text);
  const pngPath = `${renderPrefix}.png`;
  const pngBuffer = await readFile(pngPath);
  const file = await readFile(pdf.path);
  const fileStats = await stat(pdf.path);
  const checks = {
    onePage: inspections[index].pages === 1,
    notEncrypted: !inspections[index].encrypted,
    allFontsEmbedded: inspections[index].allFontsEmbedded,
    a4Landscape: isA4Landscape(info),
    underOneMegabyte: fileStats.size < 1_000_000,
    searchableRecipient: extractedText.includes(normalizeText(fixture.recipientName)),
    searchableChapterReference: ["السورة", "الأولى"].every((word) => extractedText.includes(word)),
    qrDecodes: decodeQr(pngBuffer) === fixture.qrValue,
  };

  results.push({
    engine: pdf.engine,
    pdf: pdf.path,
    png: pngPath,
    bytes: fileStats.size,
    sha256: sha256(file),
    extractedTextCharacters: extractedText.length,
    checks,
    passed: Object.values(checks).every(Boolean),
    fonts: inspections[index].fonts,
  });
}

if (process.argv.includes("--approve-baseline")) {
  await mkdir(dirname(baselinePath), { recursive: true });
  await copyFile(resolve(renderDir, "chromium.png"), baselinePath);
}

try {
  const baseline = await readFile(baselinePath);
  const actual = await readFile(resolve(renderDir, "chromium.png"));
  const comparison = comparePng(actual, baseline);
  results[0].visualBaseline = {
    ...comparison,
    passed: comparison.sameDimensions && comparison.ratio <= 0.001,
  };
  results[0].passed = results[0].passed && results[0].visualBaseline.passed;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  results[0].visualBaseline = { passed: false, reason: "baseline-missing" };
  results[0].passed = false;
}

const report = {
  generatedAt: new Date().toISOString(),
  qrExpected: fixture.qrValue,
  baseline: baselinePath,
  results,
};

await writeFile(resolve(outputDir, "verification.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (results.some(({ passed }) => !passed)) {
  process.exitCode = 1;
}
