// Drive the binder feature end to end with Playwright and capture proof
// screenshots into docs/screenshots/ (desktop 1440x900 and mobile 390x844,
// deviceScaleFactor 2). Expects `next dev` (the PGlite fallback provides the
// database):
//   BASE_URL=http://localhost:3000 node orchestration/playwright/binder-flows.mjs
//
// Proves, in order:
//   - fresh signup -> /binder shows the empty state pointing at search
//   - add-to-binder from /search round-trips to the database (owned badge,
//     quantity increments on a second add)
//   - /binder renders all three display modes (binder pages with pagination,
//     carousel with prev/next, night gallery), desktop and mobile
//   - ?mode= deep links seed the initial mode
//   - remove from the binder round-trips (count drops, card disappears)
//   - /binder while logged out redirects to /login
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(HERE, "..", "..", "docs", "screenshots");

const CARDS_TO_ADD = 11; // two binder pages (9 + 2)

// Scroll the page once to trigger native lazy image loads, then wait until
// every image that can appear in the capture (full height, viewport width;
// carousel slides parked off to the side are excluded) has settled. Without
// this, fullPage screenshots race the card art and capture blank frames.
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
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter(img => {
        const rect = img.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.right > 0 && rect.left < window.innerWidth;
      })
      .every(img => img.complete),
  );
};

// JPEG keeps the card-art-heavy captures at committable sizes (PNG fullPage
// shots of a filled binder run to multiple MB each).
const shot = async (page, name, { fullPage = true } = {}) => {
  await settleImages(page);
  await page.screenshot({ path: join(SHOTS_DIR, name), fullPage, type: "jpeg", quality: 85 });
  console.log(`captured ${name}`);
};

const assert = (cond, message) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`ok: ${message}`);
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  // Server-action round-trips re-render the page, and a revalidated page
  // re-queries the (sometimes very slow) Pokemon TCG API; give every wait a
  // generous ceiling instead of Playwright's 30s default.
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  // Fresh user via the real signup flow.
  const email = `binder+${Date.now()}@example.com`;
  const password = "supersecret1";
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(`${BASE_URL}/account`);
  assert(true, `signed up ${email}`);

  // Empty state points at search; desktop and mobile.
  await page.goto(`${BASE_URL}/binder`, { waitUntil: "networkidle" });
  await page.getByTestId("binder-empty").waitFor();
  assert(
    (await page.getByRole("link", { name: "Search cards" }).count()) === 1,
    "empty state links to search",
  );
  await shot(page, "issue-15-binder-empty.jpg");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "issue-15-binder-empty-mobile.jpg");
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add cards from search results (the DB write half of the round-trip).
  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  const addButtons = page.locator('[data-testid^="add-"]');
  await addButtons.first().waitFor();
  const buttonCount = await addButtons.count();
  assert(buttonCount >= CARDS_TO_ADD, `search shows ${buttonCount} addable cards`);
  const cardIds = [];
  for (let i = 0; i < CARDS_TO_ADD; i++) {
    const testId = await addButtons.nth(i).getAttribute("data-testid");
    cardIds.push(testId.replace("add-", ""));
  }
  for (const cardId of cardIds) {
    await page.getByTestId(`add-${cardId}`).click();
    // The owned badge appearing means the server action wrote and the page
    // re-rendered from the database.
    await page.getByTestId(`owned-${cardId}`).waitFor();
  }
  assert(true, `added ${CARDS_TO_ADD} cards from search`);
  await shot(page, "issue-15-search-add.jpg", { fullPage: false });

  // Adding an owned card again increments quantity instead of duplicating.
  await page.getByTestId(`add-${cardIds[0]}`).click();
  await page.getByTestId(`owned-${cardIds[0]}`).getByText("×2").waitFor();
  assert(true, "second add of the same card shows ×2");

  // Binder mode: fixed 9-slot pages with pagination.
  await page.goto(`${BASE_URL}/binder`, { waitUntil: "networkidle" });
  await page.getByTestId("binder-pages").waitFor();
  const countText = await page.getByTestId("binder-count").textContent();
  assert(
    countText.includes(`${CARDS_TO_ADD} cards`) && countText.includes("12 copies"),
    `header counts cards and copies (got "${countText}")`,
  );
  assert(
    (await page.getByTestId("binder-page-label").textContent()) === "Page 1 of 2",
    "11 cards paginate into 2 binder pages",
  );
  await shot(page, "issue-15-mode-binder.jpg");
  await page.getByTestId("binder-next").click();
  await page.getByTestId("binder-page-label").getByText("Page 2 of 2").waitFor();
  assert(true, "page turn reaches page 2");
  await page.getByTestId("binder-prev").click();

  // Carousel mode: focused card, prev/next, placard details.
  await page.getByTestId("mode-carousel").click();
  await page.getByTestId("carousel").waitFor();
  await page.getByTestId("carousel-placard").waitFor();
  await shot(page, "issue-15-mode-carousel.jpg");
  await page.getByTestId("carousel-next").click();
  await page.getByText(`2 of ${CARDS_TO_ADD}`).waitFor();
  assert(true, "carousel next advances the focused card");

  // Night gallery mode.
  await page.getByTestId("mode-gallery").click();
  await page.getByTestId("night-gallery").waitFor();
  assert(
    (await page.getByText("The Night Gallery").count()) === 1,
    "night gallery renders",
  );
  await shot(page, "issue-15-mode-gallery.jpg");

  // Mobile, seeded through ?mode= deep links (also proves URL mode seeding).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/binder?mode=binder`, { waitUntil: "networkidle" });
  await page.getByTestId("binder-pages").waitFor();
  await shot(page, "issue-15-mode-binder-mobile.jpg");
  await page.goto(`${BASE_URL}/binder?mode=carousel`, { waitUntil: "networkidle" });
  await page.getByTestId("carousel").waitFor();
  await shot(page, "issue-15-mode-carousel-mobile.jpg");
  await page.goto(`${BASE_URL}/binder?mode=gallery`, { waitUntil: "networkidle" });
  await page.getByTestId("night-gallery").waitFor();
  await shot(page, "issue-15-mode-gallery-mobile.jpg");
  await page.setViewportSize({ width: 1440, height: 900 });

  // Remove round-trip: the card disappears and the counts drop. The newest
  // acquisition sorts first, so it is guaranteed to be on the visible page 1.
  const removedCardId = cardIds[CARDS_TO_ADD - 1];
  await page.goto(`${BASE_URL}/binder`, { waitUntil: "networkidle" });
  await page.getByTestId("binder-pages").waitFor();
  await page.getByTestId(`remove-${removedCardId}`).click();
  await page
    .getByTestId("binder-count")
    .getByText(`${CARDS_TO_ADD - 1} cards`)
    .waitFor();
  assert(
    (await page.getByTestId(`remove-${removedCardId}`).count()) === 0,
    "removed card is gone from the binder",
  );

  // Auth gate: logged out -> login prompt.
  const anonPage = await browser.newPage();
  anonPage.setDefaultTimeout(120000);
  anonPage.setDefaultNavigationTimeout(120000);
  await anonPage.goto(`${BASE_URL}/binder`, { waitUntil: "domcontentloaded" });
  await anonPage.waitForURL(/\/login/);
  assert(true, "/binder redirects logged-out visitors to /login");
  await anonPage.close();

  await browser.close();
  console.log("binder-flows: all checks passed");
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
