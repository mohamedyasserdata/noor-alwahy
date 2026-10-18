import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToFile,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import React from "react";
import { z } from "zod";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(projectRoot, "output/pdf");
const fixtureDir = resolve(projectRoot, "tests/fixtures/pdf");
const fontDir = resolve(projectRoot, "node_modules/@fontsource/amiri/files");
const cairoFontDir = resolve(projectRoot, "node_modules/@fontsource-variable/cairo/files");
const chromiumOutput = resolve(outputDir, "certificate-chromium.pdf");
const reactPdfOutput = resolve(outputDir, "certificate-react-pdf.pdf");

const contentSchema = z.object({
  academyName: z.string().min(1),
  title: z.string().min(1),
  recipientLabel: z.string().min(1),
  recipientName: z.string().min(30),
  body: z.string().min(1),
  quranLabel: z.string().min(1),
  serialLabel: z.string().min(1),
  serial: z.string().regex(/^NWA-\d{4}-\d{5}$/u),
  dateLabel: z.string().min(1),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/u),
  verificationLabel: z.string().min(1),
  qrValue: z.url({ protocol: /^https$/u }),
  watermark: z.string().min(1),
  sourceLabel: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().min(1),
});

const quranSchema = z.object({
  source: z.object({
    name: z.literal("Tanzil Project"),
    sourcePage: z.literal("https://tanzil.net/download/"),
    textType: z.literal("Uthmani"),
    version: z.literal("1.1"),
    archiveSha256: z.literal("6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f"),
    verseCount: z.literal(6236),
  }),
  chapter: z.literal(1),
  verses: z
    .array(
      z.object({
        key: z.string().regex(/^1:[1-3]$/u),
        text: z.string().min(1),
        sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      }),
    )
    .length(3),
});

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function fontDataUri(buffer, format) {
  return `data:font/${format};base64,${buffer.toString("base64")}`;
}

const content = contentSchema.parse(
  await readJson(resolve(fixtureDir, "certificate-content.json")),
);
const quran = quranSchema.parse(await readJson(resolve(fixtureDir, "quran-sample.json")));
const quranText = quran.verses.map(({ text }) => text).join(" ﴿ ");
const qrDataUrl = await QRCode.toDataURL(content.qrValue, {
  color: { dark: "#0f2547", light: "#fffdf8" },
  errorCorrectionLevel: "H",
  margin: 2,
  width: 360,
});

await mkdir(outputDir, { recursive: true });

const cairoArabic = fontDataUri(
  await readFile(resolve(cairoFontDir, "cairo-arabic-wght-normal.woff2")),
  "woff2",
);
const cairoLatin = fontDataUri(
  await readFile(resolve(cairoFontDir, "cairo-latin-wght-normal.woff2")),
  "woff2",
);
const amiriArabic = fontDataUri(
  await readFile(resolve(fontDir, "amiri-arabic-400-normal.woff2")),
  "woff2",
);
const amiriLatin = fontDataUri(
  await readFile(resolve(fontDir, "amiri-latin-400-normal.woff2")),
  "woff2",
);

const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:CairoArabic;src:url('${cairoArabic}') format('woff2');font-weight:200 1000}
@font-face{font-family:CairoLatin;src:url('${cairoLatin}') format('woff2');font-weight:200 1000}
@font-face{font-family:AmiriArabic;src:url('${amiriArabic}') format('woff2')}
@font-face{font-family:AmiriLatin;src:url('${amiriLatin}') format('woff2')}
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;width:297mm;height:210mm}
body{background:#faf6ec;color:#0f2547;font-family:CairoArabic,CairoLatin,sans-serif}
.sheet{position:relative;width:100%;height:100%;padding:13mm 16mm;overflow:hidden;background:radial-gradient(circle at 50% -35%,#e8d5a6 0,transparent 52%),#faf6ec}
.frame{position:absolute;inset:7mm;border:1.2mm solid #0f2547;outline:.45mm solid #c9a24b;outline-offset:2mm}
.inner{position:absolute;inset:10mm;border:.35mm solid #c9a24b}
.corner{position:absolute;width:22mm;height:22mm;border-color:#c9a24b}.c1{inset-block-start:7mm;inset-inline-start:7mm;border-block-start:2mm solid;border-inline-start:2mm solid}.c2{inset-block-start:7mm;inset-inline-end:7mm;border-block-start:2mm solid;border-inline-end:2mm solid}.c3{inset-block-end:7mm;inset-inline-start:7mm;border-block-end:2mm solid;border-inline-start:2mm solid}.c4{inset-block-end:7mm;inset-inline-end:7mm;border-block-end:2mm solid;border-inline-end:2mm solid}
.content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;text-align:center}
.brand{font-size:13pt;font-weight:700;letter-spacing:.02em}.rule{width:52mm;height:.5mm;margin:3mm 0;background:#c9a24b}.title{margin:0;font:400 31pt/1.15 AmiriArabic,AmiriLatin,serif;color:#0f2547}.eyebrow{margin-top:3mm;font-size:11pt;color:#546a86}.name{max-width:225mm;margin:1mm 0 0;font:400 24pt/1.25 AmiriArabic,AmiriLatin,serif;color:#2e7d5b}.body{margin-top:1mm;font-size:11.5pt}.quran-label{margin-top:3mm;font-size:8.5pt;color:#546a86}.quran{max-width:225mm;margin-top:1mm;font:400 16pt/1.7 AmiriArabic,AmiriLatin,serif}.footer{width:100%;margin-top:auto;display:grid;grid-template-columns:47mm 1fr 47mm;align-items:end;gap:8mm}.qr img{width:27mm;height:27mm}.qr p,.details p{margin:1mm 0 0;font-size:7.8pt}.details{align-self:center}.value{font-family:CairoLatin,CairoArabic,sans-serif;font-weight:700;direction:ltr;unicode-bidi:isolate}.source{align-self:center;font-size:7.2pt;color:#546a86;line-height:1.6}.source b{font-family:CairoLatin,CairoArabic,sans-serif;direction:ltr;unicode-bidi:isolate}.watermark{position:absolute;inset-block-end:10mm;inset-inline-start:0;inset-inline-end:0;text-align:center;font-size:6.8pt;color:#6b7f99}
</style></head><body><main class="sheet"><div class="frame"></div><div class="inner"></div><i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i><section class="content"><div class="brand">${escapeHtml(content.academyName)}</div><div class="rule"></div><h1 class="title">${escapeHtml(content.title)}</h1><div class="eyebrow">${escapeHtml(content.recipientLabel)}</div><div class="name">${escapeHtml(content.recipientName)}</div><div class="body">${escapeHtml(content.body)}</div><div class="quran-label">${escapeHtml(content.quranLabel)}</div><div class="quran">${escapeHtml(quranText)}</div><div class="footer"><div class="qr"><img src="${qrDataUrl}" alt=""><p>${escapeHtml(content.verificationLabel)}</p></div><div class="source">${escapeHtml(content.sourceLabel)}<br><b>${escapeHtml(content.sourceName)} | ${escapeHtml(content.sourceUrl)}</b></div><div class="details"><p>${escapeHtml(content.serialLabel)}</p><p class="value">${escapeHtml(content.serial)}</p><p>${escapeHtml(content.dateLabel)} <span class="value">${escapeHtml(content.date)}</span></p></div></div></section><div class="watermark">${escapeHtml(content.watermark)}</div></main></body></html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 990 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: chromiumOutput,
    format: "A4",
    landscape: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    outline: true,
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
  });
} finally {
  await browser.close();
}

const amiriRegular = resolve(fontDir, "amiri-arabic-400-normal.woff");
const amiriBold = resolve(fontDir, "amiri-arabic-700-normal.woff");
const amiriLatinRegular = resolve(fontDir, "amiri-latin-400-normal.woff");
const amiriLatinBold = resolve(fontDir, "amiri-latin-700-normal.woff");

Font.register({
  family: "AmiriArabic",
  fonts: [
    { src: amiriRegular, fontWeight: 400 },
    { src: amiriBold, fontWeight: 700 },
  ],
});
Font.register({
  family: "AmiriLatin",
  fonts: [
    { src: amiriLatinRegular, fontWeight: 400 },
    { src: amiriLatinBold, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { backgroundColor: "#faf6ec", color: "#0f2547", padding: 40 },
  frame: {
    position: "absolute",
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
    borderWidth: 4,
    borderColor: "#0f2547",
  },
  inner: {
    position: "absolute",
    top: 29,
    right: 29,
    bottom: 29,
    left: 29,
    borderWidth: 1,
    borderColor: "#c9a24b",
  },
  content: { height: "100%", alignItems: "center", textAlign: "center", padding: "8 24 0" },
  arabic: { fontFamily: "AmiriArabic", direction: "rtl" },
  latin: { fontFamily: "AmiriLatin", direction: "ltr" },
  brand: { fontSize: 14, fontWeight: 700 },
  rule: { width: 145, height: 2, marginVertical: 8, backgroundColor: "#c9a24b" },
  title: { fontSize: 31, lineHeight: 1.2 },
  eyebrow: { marginTop: 6, fontSize: 12, color: "#546a86" },
  name: { maxWidth: 610, marginTop: 2, fontSize: 25, lineHeight: 1.25, color: "#2e7d5b" },
  body: { marginTop: 2, fontSize: 13 },
  quranLabel: { marginTop: 8, fontSize: 9, color: "#546a86" },
  quran: { maxWidth: 650, marginTop: 2, fontSize: 17, lineHeight: 1.7 },
  footer: {
    width: "100%",
    marginTop: "auto",
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  footerCell: { width: 145, alignItems: "center" },
  qr: { width: 76, height: 76 },
  small: { marginTop: 3, fontSize: 8.5 },
  source: { width: 270, alignItems: "center", color: "#546a86" },
  sourceLatin: { marginTop: 3, fontSize: 8 },
  detailRow: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  detailValue: { fontSize: 9, fontWeight: 700 },
  watermark: {
    position: "absolute",
    bottom: 36,
    left: 0,
    right: 0,
    fontSize: 7,
    color: "#6b7f99",
    textAlign: "center",
  },
});

const element = React.createElement;
const arabicText = (value, style) => element(Text, { style: [styles.arabic, style] }, value);
const latinText = (value, style) => element(Text, { style: [styles.latin, style] }, value);
const detailRow = (label, value) =>
  element(
    View,
    { style: styles.detailRow },
    arabicText(label, styles.small),
    latinText(value, styles.detailValue),
  );

const document = element(
  Document,
  { title: content.title, author: content.academyName, subject: "P0-T06 Arabic PDF spike" },
  element(
    Page,
    { size: "A4", orientation: "landscape", style: styles.page, wrap: false },
    element(View, { style: styles.frame }),
    element(View, { style: styles.inner }),
    element(
      View,
      { style: styles.content },
      arabicText(content.academyName, styles.brand),
      element(View, { style: styles.rule }),
      arabicText(content.title, styles.title),
      arabicText(content.recipientLabel, styles.eyebrow),
      arabicText(content.recipientName, styles.name),
      arabicText(content.body, styles.body),
      arabicText(content.quranLabel, styles.quranLabel),
      arabicText(quranText, styles.quran),
      element(
        View,
        { style: styles.footer },
        element(
          View,
          { style: styles.footerCell },
          element(Image, { src: qrDataUrl, style: styles.qr }),
          arabicText(content.verificationLabel, styles.small),
        ),
        element(
          View,
          { style: styles.source },
          arabicText(content.sourceLabel, styles.small),
          latinText(`${content.sourceName} | ${content.sourceUrl}`, styles.sourceLatin),
        ),
        element(
          View,
          { style: styles.footerCell },
          detailRow(content.serialLabel, content.serial),
          detailRow(content.dateLabel, content.date),
        ),
      ),
    ),
    arabicText(content.watermark, styles.watermark),
  ),
);

await renderToFile(document, reactPdfOutput);

process.stdout.write(`Created ${chromiumOutput}\nCreated ${reactPdfOutput}\n`);
