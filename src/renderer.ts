// ---------------------------------------------------------------------------
// renderer.ts — Puppeteer-based PNG export (1920×1080)
// ---------------------------------------------------------------------------

import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Render an HTML string to a 1920×1080 PNG file using Puppeteer.
 *
 * - Loads TailwindCSS CDN and waits for all network activity to settle.
 * - Waits for web fonts to finish loading.
 * - Screenshots the viewport at exactly 1920×1080.
 */
export async function renderToPng(
  html: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });

    // Ensure fonts and styles have settled.
    await page.evaluate("document.fonts.ready");

    await page.screenshot({
      path: outputPath,
      type: "png",
      clip: { x: 0, y: 0, width: 1920, height: 1080 },
    });
  } finally {
    await browser.close();
  }
}
