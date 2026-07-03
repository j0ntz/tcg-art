// Capture full-page landing screenshots: one desktop (1440-wide) and one mobile
// (390-wide) PNG. Reduced motion is emulated so scroll-reveal content is captured
// in its final resting state instead of mid-transition or hidden below the fold;
// the screenshots document the DESIGN, the animations are verified live.
//
// Usage: BASE_URL=<url> OUT_PREFIX=docs/screenshots/issue-13-primary node orchestration/playwright/landing-screens.mjs
// Defaults: BASE_URL=http://localhost:3000, OUT_PREFIX=docs/screenshots/landing
import { chromium } from "@playwright/test";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_PREFIX = process.env.OUT_PREFIX ?? "docs/screenshots/landing";

const capture = async (browser, { name, viewport }) => {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  // Let images/fonts settle beyond networkidle before the stitched capture.
  await page.waitForTimeout(500);
  // Scroll through the page so viewport-triggered reveals (IntersectionObserver
  // or whileInView) actually fire; a stitched capture alone never scrolls, which
  // would photograph below-the-fold content in its hidden pre-reveal state.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let yPos = 0; yPos < document.body.scrollHeight; yPos += step) {
      window.scrollTo(0, yPos);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    window.scrollTo(0, 0);
  });
  // Let the last reveal transitions/springs settle.
  await page.waitForTimeout(900);
  const path = `${OUT_PREFIX}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`captured ${path}`);
  await context.close();
};

const run = async () => {
  const browser = await chromium.launch();
  await capture(browser, { name: "desktop", viewport: { width: 1440, height: 900 } });
  await capture(browser, { name: "mobile", viewport: { width: 390, height: 844 } });
  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
