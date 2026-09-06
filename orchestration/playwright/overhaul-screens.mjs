// Vision self-review capture for the site overhaul (issue #47): every surface,
// desktop (1440) and mobile (390), including empty/404 states and the saves
// pages behind a real signup. Reduced motion is emulated so content is captured
// at rest; the one scroll-linked animation is verified live, not here.
//
//   BASE_URL=http://localhost:3000 node orchestration/playwright/overhaul-screens.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(HERE, "..", "..", "docs", "screenshots");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const settleImages = async page => {
  await page.evaluate(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    for (let y = 0; y <= document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await delay(120);
    }
    window.scrollTo(0, 0);
    await delay(120);
  });
  await page
    .waitForFunction(
      () => Array.from(document.images).every(img => img.complete),
      undefined,
      { timeout: 15000 },
    )
    .catch(() => console.warn("some images did not settle; capturing anyway"));
};

const shot = async (page, name, { fullPage = true } = {}) => {
  await settleImages(page);
  await page.screenshot({ path: join(SHOTS_DIR, `issue-47-${name}.png`), fullPage });
  console.log(`captured issue-47-${name}.png`);
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  // --- Landing ---------------------------------------------------------------
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await shot(page, "landing-desktop");
  await page.setViewportSize(MOBILE);
  await shot(page, "landing-mobile");
  await page.setViewportSize(DESKTOP);

  // --- Search: empty, art results, name results + pagination -----------------
  await page.goto(`${BASE_URL}/search`, { waitUntil: "networkidle" });
  await shot(page, "search-empty-desktop");

  await page.goto(`${BASE_URL}/search?q=${encodeURIComponent("red dragon over a volcano")}`, {
    waitUntil: "networkidle",
  });
  await page.getByTestId("result-summary").waitFor();
  await shot(page, "search-art-desktop");
  await page.setViewportSize(MOBILE);
  await shot(page, "search-art-mobile");
  await page.setViewportSize(DESKTOP);

  await page.goto(`${BASE_URL}/search?mode=name&q=charizard`, { waitUntil: "networkidle" });
  await page.getByTestId("result-summary").waitFor();
  await shot(page, "search-name-desktop");

  await page.goto(`${BASE_URL}/search?q=zzqx%20vvblorp`, { waitUntil: "networkidle" });
  await page.getByTestId("search-empty").waitFor();
  await shot(page, "search-noresults-desktop");

  // --- Card detail + zoom ----------------------------------------------------
  await page.goto(`${BASE_URL}/card/base1-4`, { waitUntil: "networkidle" });
  await page.getByTestId("card-meta").waitFor();
  await shot(page, "card-detail-desktop");
  await page.setViewportSize(MOBILE);
  await shot(page, "card-detail-mobile");
  await page.setViewportSize(DESKTOP);
  await page.getByTestId("art-zoom-open").click();
  await page.getByTestId("art-zoom-overlay").waitFor();
  await shot(page, "card-zoom-desktop", { fullPage: false });
  await page.keyboard.press("Escape");

  // Artist-filtered search reached from the detail page.
  await page.goto(`${BASE_URL}/card/base1-4`, { waitUntil: "networkidle" });
  await page.getByTestId("artist-link").click();
  await page.getByTestId("result-summary").waitFor();
  await shot(page, "search-artist-desktop");

  // --- 404 -------------------------------------------------------------------
  await page.goto(`${BASE_URL}/card/zz9-999`, { waitUntil: "networkidle" });
  await shot(page, "notfound-desktop");

  // --- Auth ------------------------------------------------------------------
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await shot(page, "login-desktop");
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await shot(page, "signup-desktop");
  await page.setViewportSize(MOBILE);
  await shot(page, "signup-mobile");
  await page.setViewportSize(DESKTOP);

  // --- Saves (real signup against the dev PGlite database) ------------------
  const email = `overhaul+${Date.now()}@example.com`;
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "supersecret1");
  await page.fill("#confirm", "supersecret1");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/account");

  await page.goto(`${BASE_URL}/saves`, { waitUntil: "networkidle" });
  await page.getByTestId("saves-empty").waitFor();
  await shot(page, "saves-empty-desktop");

  await page.goto(`${BASE_URL}/search?mode=name&q=charizard`, { waitUntil: "networkidle" });
  await page.getByTestId("result-summary").waitFor();
  const heart = page.locator('[data-testid^="fav-"]').first();
  const favId = (await heart.getAttribute("data-testid")).replace("fav-", "");
  await heart.click();
  await page.waitForSelector(`[data-testid="fav-${favId}"][data-saved="true"]`);

  await page.goto(`${BASE_URL}/saves`, { waitUntil: "networkidle" });
  await page.getByTestId(`card-tile-${favId}`).waitFor();
  await shot(page, "saves-desktop");
  await page.getByTestId("view-carousel").click();
  await page.getByTestId("carousel").waitFor();
  await shot(page, "saves-carousel-desktop");
  await page.setViewportSize(MOBILE);
  await shot(page, "saves-carousel-mobile");

  await browser.close();
  console.log("overhaul-screens: done");
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
