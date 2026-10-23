import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

import jsQR from "jsqr";
import { PNG } from "pngjs";

const projectRoot = process.cwd();
const pdfRoot = resolve(projectRoot, "output", "pdf", "quality-gate");
const renderRoot = resolve(projectRoot, "tmp", "pdfs", "quality-gate-automated");
const popplerBin = process.env.POPPLER_BIN ?? "";
const executable = (name) => join(popplerBin, process.platform === "win32" ? `${name}.exe` : name);

const expectations = [
  ["certificate-ar.pdf", 1, "landscape"],
  ["certificate-en.pdf", 1, "landscape"],
  ["grade-report-ar.pdf", 1, "portrait"],
  ["receipt-ar.pdf", 1, "portrait"],
  ["student-report-ar.pdf", 1, "portrait"],
  ["financial-report-ar.pdf", 1, "landscape"],
  ["teacher-payout-ar.pdf", 1, "portrait"],
  ["advanced-students-ar.pdf", 1, "landscape"],
  ["admin-dashboard-en.pdf", 3, "landscape"],
];

await mkdir(renderRoot, { recursive: true });
const results = [];

for (const [name, expectedPages, orientation] of expectations) {
  const path = join(pdfRoot, name);
  const info = run(executable("pdfinfo"), [path]);
  const pages = Number(/^Pages:\s+(\d+)$/mu.exec(info)?.[1]);
  const size = /^Page size:\s+([\d.]+) x ([\d.]+) pts \(A4\)$/mu.exec(info);
  const width = Number(size?.[1]);
  const height = Number(size?.[2]);
  const actualOrientation = width > height ? "landscape" : "portrait";
  const bytes = (await stat(path)).size;
  const checks = {
    pages: pages === expectedPages,
    a4: Boolean(size),
    orientation: actualOrientation === orientation,
    notEncrypted: /^Encrypted:\s+no$/mu.test(info),
    boundedSize: bytes > 1_000 && bytes < 2_000_000,
  };
  results.push({ name, pages, orientation: actualOrientation, bytes, checks });
}

const qrExpectations = [
  ["certificate-ar.pdf", "http://127.0.0.1:3000/ar/verify/ABCDEFGHIJKLMNOPQRSTUVWX12345678"],
  ["certificate-en.pdf", "http://127.0.0.1:3000/en/verify/ZYXWVUTSRQPONMLKJIHGFEDC87654321"],
];

for (const [name, expected] of qrExpectations) {
  const prefix = join(renderRoot, name.replace(/\.pdf$/u, ""));
  run(executable("pdftoppm"), [
    "-f",
    "1",
    "-singlefile",
    "-r",
    "180",
    "-png",
    join(pdfRoot, name),
    prefix,
  ]);
  const png = PNG.sync.read(await readFile(`${prefix}.png`));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
    inversionAttempts: "dontInvert",
  });
  const result = results.find((entry) => entry.name === name);
  result.checks.qr = decoded?.data === expected;
  result.qr = decoded?.data ?? null;
}

const failed = results.filter((result) => Object.values(result.checks).some((value) => !value));
process.stdout.write(`${JSON.stringify({ results, passed: failed.length === 0 }, null, 2)}\n`);
if (failed.length) process.exitCode = 1;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}
