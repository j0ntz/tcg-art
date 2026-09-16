// Both-theme proof screenshots against the post-rebase Vercel preview
// (issue #46 address round 4). Fresh queries so ISR cannot serve a
// pre-rebase page; theme forced via the cookie the toggle sets.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "").replace(/\/$/, "");
if (BASE_URL === "") throw new Error("BASE_URL is required (the preview deployment URL)");
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(HERE, "..", "..", "docs", "screenshots");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const settle = async page => {
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
    .waitForFunction(() => Array.from(document.images).every(img => img.complete), undefined, {
      timeout: 20000,
    })
    .catch(() => console.warn("images did not settle; capturing anyway"));
};

const shot = async (page, name) => {
  await settle(page);
  await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`), fullPage: true });
  console.log(`captured ${name}.png`);
};

const run = async () => {
  const browser = await chromium.launch();
  const host = new URL(BASE_URL).hostname;

  // One logged-in session shared across both themes: sign up once.
  const context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const page = await context.newPage();
  let authed = false;
  try {
    await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
    await page.fill("#email", `preview46+${Date.now()}@example.com`, { timeout: 15000 });
    await page.fill("#password", "supersecret1");
    await page.fill("#confirm", "supersecret1");
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForURL("**/account", { timeout: 30000 });
    authed = true;
    // Save two cards and build a deck so the logged-in surfaces have data.
    await page.goto(`${BASE_URL}/search?q=eevee`, { waitUntil: "networkidle" });
    const hearts = page.locator('[data-testid^="fav-"]');
    await hearts.first().waitFor();
    const ids = [];
    for (let i = 0; i < 2; i++) {
      ids.push((await hearts.nth(i).getAttribute("data-testid")).replace("fav-", ""));
    }
    for (const id of ids) {
      await Promise.all([
        page.waitForResponse(r => r.request().method() === "POST"),
        page.getByTestId(`fav-${id}`).click(),
      ]);
      await page.waitForSelector(`[data-testid="fav-${id}"][data-saved="true"]`);
    }
    await page.getByTestId(`deck-menu-${ids[0]}`).click();
    await page.getByTestId(`deck-create-name-${ids[0]}`).fill("Preview Proof");
    await Promise.all([
      page.waitForResponse(r => r.request().method() === "POST"),
      page.getByTestId(`deck-create-submit-${ids[0]}`).click(),
    ]);
    console.log(`authed with ${ids.length} saves and one deck`);
  } catch (e) {
    console.warn(`preview signup unavailable (${e.message}); logged-out surfaces only`);
  }

  for (const theme of ["light", "dark"]) {
    await context.addCookies([{ name: "theme", value: theme, domain: host, path: "/" }]);

    await page.setViewportSize(DESKTOP);
    await page.goto(`${BASE_URL}/?fresh=${theme}`, { waitUntil: "networkidle" });
    await shot(page, `issue-46-preview-home-${theme}-desktop`);
    await page.setViewportSize(MOBILE);
    await shot(page, `issue-46-preview-home-${theme}-mobile`);
    await page.setViewportSize(DESKTOP);

    // Fresh query (squirtle/Water) the pre-rebase deployment never rendered:
    // an ISR-stale serve would miss the type-colored chip this asserts.
    await page.goto(`${BASE_URL}/search?mode=name&q=squirtle&type=Water&sort=az`, {
      waitUntil: "networkidle",
    });
    await page.getByTestId("chip-type-Water").waitFor();
    await shot(page, `issue-46-preview-search-facets-${theme}-desktop`);
    await page.setViewportSize(MOBILE);
    await shot(page, `issue-46-preview-search-facets-${theme}-mobile`);
    await page.setViewportSize(DESKTOP);

    if (authed) {
      await page.goto(`${BASE_URL}/saves`, { waitUntil: "networkidle" });
      await page.locator('[data-testid^="card-tile-"]').first().waitFor();
      await shot(page, `issue-46-preview-saves-${theme}-desktop`);
      await page.goto(`${BASE_URL}/decks`, { waitUntil: "networkidle" });
      await page.locator('[data-testid^="deck-link-"]').first().waitFor();
      await shot(page, `issue-46-preview-decks-${theme}-desktop`);
    }
  }

  await browser.close();
  console.log("preview shots: done");
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
