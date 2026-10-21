import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import { DateTime } from "luxon";
import puppeteer from "puppeteer-core";

export type ReceiptPdfDocument = {
  locale: "ar" | "en";
  receiptNo: string;
  invoiceNo: string;
  studentName: string;
  kind: "payment" | "refund";
  amount: string;
  currency: string;
  method: string | null;
  paidAt: string | null;
  confirmedAt: string;
};

const fontRoot = join(process.cwd(), "node_modules", "@fontsource-variable", "cairo", "files");

export async function renderReceiptPdf(document: ReceiptPdfDocument) {
  const html = await createReceiptHtml(document);
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? {} : { args: chromium.args }),
    defaultViewport: { height: 960, width: 1280 },
    executablePath: await resolveChromiumExecutable(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await page.pdf({ format: "A4", outline: true, printBackground: true, tagged: true });
  } finally {
    await browser.close();
  }
}

export async function createReceiptHtml(document: ReceiptPdfDocument) {
  const [arabicFont, latinFont] = await Promise.all([
    loadFont(join(fontRoot, "cairo-arabic-wght-normal.woff2")),
    loadFont(join(fontRoot, "cairo-latin-wght-normal.woff2")),
  ]);
  const ar = document.locale === "ar";
  const labels = ar
    ? {
        academy: "أكاديمية نور الوحي",
        title: document.kind === "refund" ? "إيصال استرداد" : "إيصال سداد",
        receipt: "رقم الإيصال",
        invoice: "رقم الفاتورة",
        student: "الطالب",
        amount: document.kind === "refund" ? "المبلغ المسترد" : "المبلغ المسدد",
        method: "طريقة الدفع",
        paidAt: "تاريخ العملية",
        confirmedAt: "تاريخ التأكيد",
        manual: "دفع يدوي",
        note: "أُصدر هذا الإيصال آليًا من سجل مالي مؤكد وغير قابل للتعديل.",
      }
    : {
        academy: "Noor Al-Wahy Academy",
        title: document.kind === "refund" ? "Refund receipt" : "Payment receipt",
        receipt: "Receipt number",
        invoice: "Invoice number",
        student: "Student",
        amount: document.kind === "refund" ? "Refunded amount" : "Paid amount",
        method: "Payment method",
        paidAt: "Transaction date",
        confirmedAt: "Confirmation date",
        manual: "Manual payment",
        note: "This receipt was generated from a confirmed, immutable financial record.",
      };
  const money = new Intl.NumberFormat(document.locale, {
    style: "currency",
    currency: document.currency,
  }).format(Number(document.amount));
  const date = (value: string | null) => {
    if (!value) return "—";
    const parsed = DateTime.fromISO(value, { zone: "utc" }).setZone("Africa/Cairo");
    return parsed.isValid
      ? parsed.setLocale(document.locale).toLocaleString(DateTime.DATETIME_MED)
      : "—";
  };
  const row = (label: string, value: string, ltr = false) =>
    `<div class="row"><span>${label}</span><strong${ltr ? ' dir="ltr"' : ""}>${escapeHtml(value)}</strong></div>`;

  return `<!doctype html><html lang="${document.locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Cairo;src:url('${arabicFont}') format('woff2');font-weight:200 1000}@font-face{font-family:CairoLatin;src:url('${latinFont}') format('woff2');font-weight:200 1000}@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#102b50;background:#fff;font:11pt/1.75 Cairo,CairoLatin,sans-serif}.sheet{min-height:267mm;border:.4mm solid #d7deea;border-radius:6mm;overflow:hidden}.hero{position:relative;overflow:hidden;background:#102b50;color:#fff;padding:14mm}.hero:after{content:"";position:absolute;inset-inline-end:-20mm;inset-block-start:-25mm;width:75mm;height:75mm;border:2mm solid #d3aa45;border-radius:50%;opacity:.45}.academy{color:#d3aa45;font-weight:900}.title{margin:4mm 0 0;font-size:28pt;line-height:1.3}.receipt{margin:12mm}.number{display:inline-block;border-radius:99px;background:#f7efd9;color:#8a6517;padding:2.5mm 5mm;font-weight:850}.rows{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-block-start:8mm}.row{min-height:27mm;border:.35mm solid #d7deea;border-radius:4mm;padding:5mm}.row span{display:block;color:#65758b;font-size:8.5pt}.row strong{display:block;margin-block-start:2mm;font-size:13pt}.amount{margin-block-start:7mm;border-radius:5mm;background:#102b50;color:#fff;padding:8mm;text-align:center}.amount span{display:block;color:#d2dbea}.amount strong{display:block;color:#d3aa45;font-size:29pt;line-height:1.35}.note{margin-block-start:9mm;border-block-start:.35mm solid #d7deea;padding-block-start:5mm;color:#65758b;text-align:center;font-size:8.5pt}
  </style></head><body><main class="sheet"><header class="hero"><div class="academy">${labels.academy}</div><h1 class="title">${labels.title}</h1></header><section class="receipt"><div class="number"><span>${labels.receipt}: </span><b dir="ltr">${escapeHtml(document.receiptNo)}</b></div><div class="rows">${row(labels.invoice, document.invoiceNo, true)}${row(labels.student, document.studentName)}${row(labels.method, document.method ?? labels.manual)}${row(labels.paidAt, date(document.paidAt))}${row(labels.confirmedAt, date(document.confirmedAt))}</div><div class="amount"><span>${labels.amount}</span><strong dir="ltr">${escapeHtml(money)}</strong></div><p class="note">${labels.note}</p></section></main></body></html>`;
}

async function resolveChromiumExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const packUrl = process.env.CHROMIUM_PACK_URL;
  if (!packUrl) throw new Error("chromium_runtime_unavailable");
  const parsed = new URL(packUrl);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("invalid_chromium_pack_url");
  return chromium.executablePath(parsed.toString());
}
async function loadFont(path: string) {
  return `data:font/woff2;base64,${(await readFile(path)).toString("base64")}`;
}
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
