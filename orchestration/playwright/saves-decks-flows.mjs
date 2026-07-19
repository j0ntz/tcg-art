// Drive the favorites + decks + faceted-search experience end to end with
// Playwright and capture proof screenshots into docs/screenshots/ (desktop
// 1440x900 and mobile 390x844, deviceScaleFactor 2). Expects `next dev` (the
// PGlite fallback provides the database):
//   BASE_URL=http://localhost:3000 node orchestration/playwright/saves-decks-flows.mjs
//
// Proves, in order:
//   - fresh signup -> /saves shows the empty state pointing at search
//   - art search shows the facet rail; a Type filter narrows the grid to
//     exactly the option's advertised count, chips appear, clear-all clears
//   - sort orders: alphabetical is verified element-by-element, oldest era
//     surfaces the Base-set Charizard first
//   - filter+sort state is URL-encoded: a cold load of the URL restores it
//   - favorite round-trip: heart on search -> appears in /saves (grid and
//     carousel views) -> unheart on /saves removes it
//   - deck lifecycle: create from /decks and from the tile menu, add/remove
//     cards, count badges track, rename, delete
//   - mobile: bottom-sheet filter panel applies the same filters
//   - logged out: /saves redirects to /login; tiles show the sign-in heart
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(HERE, "..", "..", "docs", "screenshots");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

// Scroll the page once to trigger native lazy image loads, then wait until
// every image that can appear in the capture has settled. Without this,
// fullPage screenshots race the card art and capture blank frames.
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

// JPEG keeps the card-art-heavy captures at committable sizes.
const shot = async (page, name, { fullPage = true } = {}) => {
  await settleImages(page);
  await page.screenshot({ path: join(SHOTS_DIR, name), fullPage, type: "jpeg", quality: 85 });
  console.log(`captured ${name}`);
};

const assert = (cond, message) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`ok: ${message}`);
};

// Click something that fires a server action and wait for the action's POST
// round-trip, so a follow-up navigation cannot outrun the database write.
const clickAction = async (page, locator) => {
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST"),
    locator.click(),
  ]);
};

const tileNames = page =>
  page.locator('[data-testid^="card-tile-"] p.text-sm.font-medium').allTextContents();

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const page = await context.newPage();
  // Server-action round-trips re-render the page, and revalidated pages can
  // re-query the (sometimes very slow) Pokemon TCG API; give every wait a
  // generous ceiling instead of Playwright's 30s default.
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  // ---- Fresh user via the real signup flow ----
  const email = `saves+${Date.now()}@example.com`;
  const password = "supersecret1";
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(`${BASE_URL}/account`);
  assert(true, `signed up ${email}`);

  // ---- Saves empty state, desktop and mobile ----
  await page.goto(`${BASE_URL}/saves`, { waitUntil: "networkidle" });
  await page.getByTestId("saves-empty").waitFor();
  assert(
    (await page.getByRole("link", { name: "Search cards" }).count()) === 1,
    "saves empty state links to search",
  );
  await shot(page, "issue-46-saves-empty.jpg");
  await page.setViewportSize(MOBILE);
  await shot(page, "issue-46-saves-empty-mobile.jpg");
  await page.setViewportSize(DESKTOP);

  // ---- Faceted art search: counts, narrowing, chips ----
  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  await page.locator('[data-testid^="card-tile-"]').first().waitFor();
  const unfilteredCount = Number(
    (await page.getByTestId("result-count").innerText()).replace(/[^0-9]/g, ""),
  );
  const fireOption = page.getByTestId("facet-type-Fire");
  await fireOption.waitFor();
  const fireLabelCount = Number(
    await fireOption.evaluate(input =>
      input.closest("label").querySelector("span.tnum").textContent.replace(/[^0-9]/g, ""),
    ),
  );
  assert(fireLabelCount > 0, `Type facet lists Fire with count ${fireLabelCount}`);
  await shot(page, "issue-46-search-facets.jpg", { fullPage: false });

  await fireOption.check();
  await page.getByTestId("chip-type-Fire").waitFor();
  await page.waitForFunction(
    ({ expected }) =>
      document.querySelector('[data-testid="result-count"]')?.textContent.replace(/[^0-9]/g, "") ===
      String(expected),
    { expected: fireLabelCount },
  );
  assert(true, `Fire filter narrows ${unfilteredCount} -> ${fireLabelCount} (matches facet count)`);
  const fireTileCount = await page.locator('[data-testid^="card-tile-"]').count();
  assert(
    fireTileCount === Math.min(fireLabelCount, 24),
    `grid shows ${fireTileCount} Fire tiles`,
  );
  await shot(page, "issue-46-search-filtered.jpg", { fullPage: false });

  // ---- Sorts: alphabetical fully verified; era sorts spot-checked ----
  await page.getByTestId("sort-select").selectOption("az");
  await page.waitForFunction(() => window.location.search.includes("sort=az"));
  await page.waitForLoadState("networkidle");
  const azNames = await tileNames(page);
  const sortedAz = [...azNames].sort((a, b) => a.localeCompare(b));
  assert(JSON.stringify(azNames) === JSON.stringify(sortedAz), "alphabetical sort orders the grid");

  await page.getByTestId("sort-select").selectOption("oldest");
  await page.waitForFunction(() => window.location.search.includes("sort=oldest"));
  await page.waitForLoadState("networkidle");
  const oldestFirstSet = await page
    .locator('[data-testid^="card-tile-"]')
    .first()
    .locator("p.text-xs")
    .first()
    .innerText();
  assert(/Base/.test(oldestFirstSet), `oldest era surfaces a Base-set card first (${oldestFirstSet})`);

  await page.getByTestId("sort-select").selectOption("newest");
  await page.waitForFunction(() => window.location.search.includes("sort=newest"));
  await page.waitForLoadState("networkidle");
  const newestFirstSet = await page
    .locator('[data-testid^="card-tile-"]')
    .first()
    .locator("p.text-xs")
    .first()
    .innerText();
  assert(
    newestFirstSet !== oldestFirstSet,
    `newest era re-orders (${newestFirstSet} vs ${oldestFirstSet})`,
  );

  // ---- URL state restore: cold-load the filtered/sorted URL ----
  const filteredUrl = page.url();
  await page.goto("about:blank");
  await page.goto(filteredUrl, { waitUntil: "networkidle" });
  await page.getByTestId("chip-type-Fire").waitFor();
  assert(await page.getByTestId("facet-type-Fire").isChecked(), "reloaded URL restores the checked facet");
  assert(
    (await page.getByTestId("sort-select").inputValue()) === "newest",
    "reloaded URL restores the sort",
  );
  assert(
    (await page.getByTestId("result-count").innerText()).replace(/[^0-9]/g, "") ===
      String(fireLabelCount),
    "reloaded URL restores the narrowed result set",
  );

  await page.getByTestId("clear-all").click();
  await page.waitForFunction(() => !window.location.search.includes("type=Fire"));
  assert(
    (await page.getByTestId("applied-chips").count()) === 0,
    "clear-all removes every chip",
  );

  // ---- Favorite round-trip ----
  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  const heartButtons = page.locator('[data-testid^="fav-"]');
  await heartButtons.first().waitFor();
  const savedIds = [];
  for (let i = 0; i < 3; i++) {
    const testId = await heartButtons.nth(i).getAttribute("data-testid");
    savedIds.push(testId.replace("fav-", ""));
  }
  for (const cardId of savedIds) {
    await clickAction(page, page.getByTestId(`fav-${cardId}`));
    await page.waitForSelector(`[data-testid="fav-${cardId}"][data-saved="true"]`);
  }
  assert(true, `saved ${savedIds.length} cards from search (${savedIds.join(", ")})`);

  await page.goto(`${BASE_URL}/saves`, { waitUntil: "networkidle" });
  for (const cardId of savedIds) {
    await page.getByTestId(`card-tile-${cardId}`).waitFor();
  }
  assert(true, "all saved cards appear on /saves");
  await shot(page, "issue-46-saves.jpg");
  await page.setViewportSize(MOBILE);
  await shot(page, "issue-46-saves-mobile.jpg");
  await page.setViewportSize(DESKTOP);

  // Carousel is the retained alternate view.
  await page.getByTestId("view-carousel").click();
  await page.getByTestId("carousel").waitFor();
  await page.getByTestId("carousel-placard").waitFor();
  await shot(page, "issue-46-saves-carousel.jpg", { fullPage: false });
  await page.getByTestId("view-grid").click();
  await page.locator('[data-testid^="card-tile-"]').first().waitFor();

  // Unheart round-trips: the card leaves the saves grid.
  const removedId = savedIds.pop();
  await clickAction(page, page.getByTestId(`fav-${removedId}`));
  await page.waitForSelector(`[data-testid="card-tile-${removedId}"]`, { state: "detached" });
  assert(true, `unhearting removed ${removedId} from /saves`);

  // Saves facets: the rail is present and a filter narrows with a chip.
  await page.getByTestId("facet-type-Fire").waitFor();
  await page.getByTestId("facet-type-Fire").check();
  await page.getByTestId("chip-type-Fire").waitFor();
  assert(true, "saves grid filters with chips like search");
  await page.getByTestId("clear-all").click();
  await page.waitForFunction(() => !window.location.search.includes("type=Fire"));

  // ---- Deck lifecycle ----
  await page.goto(`${BASE_URL}/decks`, { waitUntil: "networkidle" });
  await page.getByTestId("decks-empty").waitFor();
  await page.getByTestId("deck-create-name").fill("Ember Study");
  await clickAction(page, page.getByTestId("deck-create-submit"));
  const deckLink = page.locator('[data-testid^="deck-link-"]').first();
  await deckLink.waitFor();
  const emberDeckId = (await deckLink.getAttribute("data-testid")).replace("deck-link-", "");
  assert(true, `created deck Ember Study (${emberDeckId})`);

  await page.goto(`${BASE_URL}/decks/${emberDeckId}`, { waitUntil: "networkidle" });
  await page.getByTestId("deck-empty").waitFor();
  await shot(page, "issue-46-deck-empty.jpg", { fullPage: false });

  // Add two cards from search via the tile menu.
  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  const deckCardIds = savedIds.slice(0, 2);
  for (const cardId of deckCardIds) {
    await page.getByTestId(`deck-menu-${cardId}`).click();
    await clickAction(page, page.getByTestId(`deck-add-${emberDeckId}-${cardId}`));
    await page.keyboard.press("Escape");
  }
  assert(true, `added ${deckCardIds.length} cards to Ember Study from search`);

  // Third card births a new deck straight from the menu's create form.
  const soloCardId = removedId;
  await page.getByTestId(`deck-menu-${soloCardId}`).click();
  await page.getByTestId(`deck-create-name-${soloCardId}`).fill("Volcano Picks");
  await clickAction(page, page.getByTestId(`deck-create-submit-${soloCardId}`));
  assert(true, "created Volcano Picks holding a card via the tile menu");

  await page.goto(`${BASE_URL}/decks`, { waitUntil: "networkidle" });
  const countTexts = await page.locator('[data-testid^="deck-count-"]').allTextContents();
  assert(
    countTexts.some(text => text.includes("2 cards")) &&
      countTexts.some(text => text.includes("1 card")),
    `deck list badges track card counts (${countTexts.join(" / ")})`,
  );
  await shot(page, "issue-46-decks.jpg");

  const volcanoDeckId = (
    await page
      .locator('[data-testid^="deck-link-"]')
      .filter({ hasText: "Volcano Picks" })
      .getAttribute("data-testid")
  ).replace("deck-link-", "");

  // Deck page: grid with facets, remove, rename.
  await page.goto(`${BASE_URL}/decks/${emberDeckId}`, { waitUntil: "networkidle" });
  for (const cardId of deckCardIds) {
    await page.getByTestId(`card-tile-${cardId}`).waitFor();
  }
  await page.getByTestId("facet-type-Fire").waitFor();
  assert(true, "deck page shows its cards with the facet rail");
  await shot(page, "issue-46-deck.jpg");
  await page.setViewportSize(MOBILE);
  await shot(page, "issue-46-deck-mobile.jpg");
  await page.setViewportSize(DESKTOP);

  const removedFromDeck = deckCardIds[0];
  await clickAction(page, page.getByTestId(`deck-remove-${removedFromDeck}`));
  await page.waitForSelector(`[data-testid="card-tile-${removedFromDeck}"]`, { state: "detached" });
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="deck-card-count"]')?.textContent.includes("1 card"),
  );
  assert(true, "removing a card updates the deck grid and count badge");

  await page.getByTestId("deck-rename-name").fill("Ember Archive");
  await clickAction(page, page.getByTestId("deck-rename-submit"));
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="deck-title"]')?.textContent.includes("Ember Archive"),
  );
  assert(true, "rename updates the deck title");

  // Delete the second deck; its page redirects back to the list.
  await page.goto(`${BASE_URL}/decks/${volcanoDeckId}`, { waitUntil: "networkidle" });
  await page.getByTestId("deck-delete").click();
  await page.waitForURL(`${BASE_URL}/decks`);
  await page.waitForLoadState("networkidle");
  assert(
    (await page.locator('[data-testid^="deck-link-"]').filter({ hasText: "Volcano Picks" }).count()) === 0,
    "deleting a deck removes it from the list",
  );

  // ---- Mobile bottom-sheet filters ----
  await page.setViewportSize(MOBILE);
  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  await page.locator('[data-testid^="card-tile-"]').first().waitFor();
  await page.getByTestId("filter-open").click();
  await page.getByTestId("filter-sheet").waitFor();
  await shot(page, "issue-46-search-sheet-mobile.jpg", { fullPage: false });
  await page.getByTestId("sheet-facet-type-Fire").check();
  await page.getByTestId("filter-sheet-done").click();
  await page.getByTestId("chip-type-Fire").waitFor();
  await page.waitForFunction(
    ({ expected }) =>
      document.querySelector('[data-testid="result-count"]')?.textContent.replace(/[^0-9]/g, "") ===
      String(expected),
    { expected: fireLabelCount },
  );
  assert(true, "mobile sheet applies the same Fire filter");
  await shot(page, "issue-46-search-filtered-mobile.jpg", { fullPage: false });
  await page.setViewportSize(DESKTOP);

  // ---- Logged out gates ----
  await context.clearCookies();
  await page.goto(`${BASE_URL}/saves`, { waitUntil: "networkidle" });
  await page.waitForURL(`${BASE_URL}/login`);
  assert(true, "/saves while logged out redirects to /login");
  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  await page.locator('[data-testid^="fav-login-"]').first().waitFor();
  assert(true, "logged-out tiles offer the sign-in save prompt");

  await browser.close();
  console.log("ALL SAVES/DECKS/FACETS FLOWS PASSED");
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
