import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";
import QRCode from "qrcode";

export type CertificatePdfDocument = {
  locale: "ar" | "en";
  serialNo: string;
  verifyUrl: string;
  payload: { student_name: string; achievement: string; issued_on: string; serial_no: string };
  template: {
    title_ar: string;
    title_en: string | null;
    body_ar: string;
    body_en: string | null;
    theme: unknown;
    signatures: unknown;
  };
  assets: { logo?: string; seal?: string; signatures: Record<string, string> };
};

const fontRoot = join(process.cwd(), "node_modules", "@fontsource-variable", "cairo", "files");

export async function renderCertificatePdf(document: CertificatePdfDocument) {
  const html = await createCertificateHtml(document);
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? {} : { args: chromium.args }),
    defaultViewport: { height: 900, width: 1280 },
    executablePath: await resolveChromiumExecutable(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await page.pdf({
      format: "A4",
      landscape: true,
      outline: true,
      printBackground: true,
      tagged: true,
    });
  } finally {
    await browser.close();
  }
}

export async function createCertificateHtml(document: CertificatePdfDocument) {
  const [arabicFont, latinFont, amiriFont, qr] = await Promise.all([
    loadFont(join(fontRoot, "cairo-arabic-wght-normal.woff2")),
    loadFont(join(fontRoot, "cairo-latin-wght-normal.woff2")),
    loadFont(
      join(
        process.cwd(),
        "node_modules",
        "@fontsource",
        "amiri",
        "files",
        "amiri-arabic-400-normal.woff2",
      ),
    ),
    QRCode.toDataURL(document.verifyUrl, { errorCorrectionLevel: "H", margin: 1, width: 360 }),
  ]);
  const ar = document.locale === "ar";
  const theme = normalizeTheme(document.template.theme);
  const title =
    ar || !document.template.title_en ? document.template.title_ar : document.template.title_en;
  const body =
    ar || !document.template.body_en ? document.template.body_ar : document.template.body_en;
  const renderedBody = renderBody(body, document.payload);
  const signatures = normalizeSignatures(document.template.signatures)
    .map((signature) => {
      const image = signature.image_path
        ? document.assets.signatures[signature.image_path]
        : undefined;
      return `<div class="signature">${image ? `<img src="${image}" alt="">` : '<div class="signature-line"></div>'}<strong>${escapeHtml(signature.name)}</strong><span>${escapeHtml(signature.title)}</span></div>`;
    })
    .join("");
  const ornament = theme.style === "minimal" ? "✦" : theme.style === "illuminated" ? "۞" : "❈";

  return `<!doctype html><html lang="${document.locale}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Cairo;src:url('${arabicFont}') format('woff2');font-weight:200 1000}@font-face{font-family:CairoLatin;src:url('${latinFont}') format('woff2');font-weight:200 1000}@font-face{font-family:Amiri;src:url('${amiriFont}') format('woff2');font-weight:400}@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;width:297mm;height:210mm;background:white}body{padding:7mm;color:${theme.primary};font:11pt/1.75 Cairo,CairoLatin,sans-serif}.sheet{position:relative;display:flex;height:196mm;overflow:hidden;border:1.7mm solid ${theme.primary};padding:3mm}.sheet:before{content:"";position:absolute;inset:3mm;border:.7mm solid ${theme.accent};pointer-events:none}.corners{position:absolute;inset:5mm;border:1px solid ${theme.accent}66;clip-path:polygon(0 0,18% 0,18% 1px,82% 1px,82% 0,100% 0,100% 18%,calc(100% - 1px) 18%,calc(100% - 1px) 82%,100% 82%,100% 100%,82% 100%,82% calc(100% - 1px),18% calc(100% - 1px),18% 100%,0 100%,0 82%,1px 82%,1px 18%,0 18%);background:${theme.accent}22}.content{position:relative;z-index:1;display:flex;width:100%;flex-direction:column;align-items:center;justify-content:space-between;padding:8mm 14mm 7mm;text-align:center}.top{display:flex;width:100%;align-items:center;justify-content:space-between}.logo,.seal{width:25mm;height:25mm;object-fit:contain}.asset-space{width:25mm}.academy{font-weight:900;color:${theme.primary};letter-spacing:.4px}.ornament{color:${theme.accent};font-size:21pt;line-height:1}.title{margin:1mm 0 0;color:${theme.primary};font:400 31pt/1.35 Amiri,Cairo,serif}.body{max-width:225mm;margin:2mm auto 0;white-space:pre-wrap;color:${theme.primary};font:400 17pt/1.9 Amiri,Cairo,serif}.student{display:block;margin:1mm 0;color:${theme.accent};font-size:24pt;font-weight:900}.footer{display:grid;width:100%;grid-template-columns:1fr auto 1fr;align-items:end;gap:8mm}.signatures{display:flex;justify-content:center;gap:16mm}.signature{min-width:35mm;text-align:center}.signature img{display:block;width:28mm;height:12mm;margin:auto;object-fit:contain}.signature-line{width:28mm;border-block-start:.35mm solid ${theme.primary};margin:12mm auto 1mm}.signature strong,.signature span{display:block;font-size:8pt}.signature span{color:#66758a}.verify{display:flex;align-items:center;gap:3mm;text-align:start}.verify img{width:23mm;height:23mm}.verify p{margin:0;font-size:6.5pt;color:#66758a}.serial{font-weight:800;color:${theme.primary}}.issue-date{justify-self:end;font-size:8pt;color:#66758a}
  </style></head><body><main class="sheet"><div class="corners"></div><div class="content"><div class="top">${document.assets.logo ? `<img class="logo" src="${document.assets.logo}" alt="">` : '<div class="asset-space"></div>'}<div><div class="academy">${ar ? "أكاديمية نور الوحي" : "Noor Al-Wahy Academy"}</div><div class="ornament">${ornament}</div></div>${document.assets.seal ? `<img class="seal" src="${document.assets.seal}" alt="">` : '<div class="asset-space"></div>'}</div><div><h1 class="title">${escapeHtml(title)}</h1><div class="body">${escapeHtml(renderedBody).replaceAll("\n", "<br>")}</div></div><div class="footer"><div class="verify"><img src="${qr}" alt="QR"><p>${ar ? "امسح للتحقق من صحة الشهادة" : "Scan to verify this certificate"}<br><span class="serial" dir="ltr">${escapeHtml(document.serialNo)}</span></p></div><div class="signatures">${signatures}</div><div class="issue-date">${ar ? "تاريخ الإصدار" : "Issued on"}<br><b dir="ltr">${escapeHtml(document.payload.issued_on)}</b></div></div></div></main></body></html>`;
}

function renderBody(body: string, payload: CertificatePdfDocument["payload"]) {
  return body
    .replaceAll("{{student_name}}", `\n${payload.student_name}\n`)
    .replaceAll("{{achievement}}", payload.achievement)
    .replaceAll("{{issued_on}}", payload.issued_on)
    .replaceAll("{{serial_no}}", payload.serial_no);
}
function normalizeTheme(value: unknown) {
  const theme = value as Record<string, unknown>;
  const color = (candidate: unknown, fallback: string) =>
    typeof candidate === "string" && /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : fallback;
  return {
    style: typeof theme?.style === "string" ? theme.style : "geometric",
    primary: color(theme?.primary, "#102b50"),
    accent: color(theme?.accent, "#d3aa45"),
  };
}
function normalizeSignatures(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: String(item.name ?? ""),
      title: String(item.title ?? ""),
      image_path: typeof item.image_path === "string" ? item.image_path : undefined,
    }))
    .filter((item) => item.name && item.title);
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
