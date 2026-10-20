import "server-only";

import chromium from "@sparticuz/chromium-min";
import puppeteer from "puppeteer-core";

const defaultChromiumPackUrl =
  "https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.tar";

export async function renderHtmlPdf(html: string) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await resolveExecutablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      outline: true,
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
    });
  } finally {
    await browser.close();
  }
}

async function resolveExecutablePath() {
  const configuredPath = process.env.CHROMIUM_EXECUTABLE_PATH?.trim();
  if (configuredPath) return configuredPath;

  const packUrl = process.env.CHROMIUM_PACK_URL?.trim() || defaultChromiumPackUrl;
  return chromium.executablePath(packUrl);
}
