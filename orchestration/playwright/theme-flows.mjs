// Drive the dark/light theme system end to end and capture the proof set
// (issue #57): both themes, every main surface, desktop (1440) + mobile (390).
//
//   BASE_URL=http://localhost:3000 node orchestration/playwright/theme-flows.mjs
//
// Assertions, in order:
//   1. system default honored: a fresh context with prefers-color-scheme dark
//      renders the dark palette with NO theme cookie and NO data-theme attr;
//      the same context with light renders the light palette.
//   2. system-change reactivity: flipping the emulated OS preference on a live
//      page re-themes it without a reload.
//   3. toggle round-trip: choosing Light while the OS is dark sets the cookie,
//      re-themes instantly, and SURVIVES a reload.
//   4. no flash of the wrong theme: the server-rendered HTML for a reload with
//      a `theme=light` cookie already carries data-theme="light", so the first
//      paint is correct (checked on the raw response body, before any JS).
//   5. back to System clears the override and returns to the OS preference.
//   6. SURFACE completeness (issue #59): every audited surface is checked on
//      PAINTED PIXELS, not on body/html computed styles. A child container with
//      a hardcoded color paints over a correctly themed body, so body-level
//      assertions pass while the user sees the wrong theme; that is exactly how
//      the search page shipped light-in-dark. See auditPaintedTheme below.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(HERE, "..", "..", "docs", "screenshots");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const assert = (cond, message) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`ok: ${message}`);
};

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
    .waitForFunction(() => Array.from(document.images).every(img => img.complete), undefined, {
      timeout: 15000,
    })
    .catch(() => console.warn("some images did not settle; capturing anyway"));
};

const shot = async (page, name, prefix = "issue-57") => {
  await settleImages(page);
  await page.screenshot({ path: join(SHOTS_DIR, `${prefix}-${name}.png`), fullPage: true });
  console.log(`captured ${prefix}-${name}.png`);
};

// Click something that fires a server action and wait for the POST round-trip,
// so a follow-up navigation cannot outrun the database write.
const clickAction = async (page, locator) => {
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST"),
    locator.click(),
  ]);
};

// Colors here are authored in OKLCH, wrapped in light-dark(), and compiled by
// Lightning CSS, so getComputedStyle hands back a MIX of color spaces:
// oklch(), oklab(), lab() and rgba() all show up on the same page. String
// parsing would read a lightness as a red channel, and canvas fillStyle echoes
// these spaces back verbatim rather than normalizing them.
//
// `color-mix(in srgb, X 100%, transparent)` is the reliable normalizer: the
// engine resolves it at computed-value time and always serializes the result as
// `color(srgb r g b / a)` with 0..1 channels, whatever X was authored in.
const COLOR_HELPERS = `
  const probe = document.createElement("div");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const luminance = css => {
    probe.style.color = "";
    probe.style.color = "color-mix(in srgb, " + css + " 100%, transparent)";
    const resolved = getComputedStyle(probe).color;
    const parts = resolved.startsWith("color(srgb")
      ? resolved.slice(resolved.indexOf("srgb") + 4, resolved.indexOf(")")).split("/")
      : null;
    if (parts == null) throw new Error("unparsed color: " + css + " -> " + resolved);
    const [r, g, b] = parts[0].trim().split(/\\s+/).map(Number);
    const alpha = parts.length > 1 ? Number(parts[1]) : 1;
    if (alpha === 0) return null;
    const channel = s => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
`;

// The single source of truth for "which theme is on screen": the resolved
// background luminance of <body>. Measuring the painted color beats reading the
// attribute, because it also proves the token layer actually switched.
const bodyLightness = page =>
  page.evaluate(
    new Function(`${COLOR_HELPERS} return luminance(getComputedStyle(document.body).backgroundColor);`),
  );

const isDark = async page => (await bodyLightness(page)) < 0.25;
const isLight = async page => (await bodyLightness(page)) > 0.75;

const themeAttr = page => page.evaluate(() => document.documentElement.dataset.theme ?? null);

const cookieValue = async context => {
  const cookie = (await context.cookies()).find(c => c.name === "theme");
  return cookie?.value ?? null;
};

// Contrast of every visible text node against its nearest painted background.
// Catches the classic dark-theme regression: a surface that flipped while the
// text on it did not.
const lowContrastText = page =>
  page.evaluate(
    new Function(`${COLOR_HELPERS}
    const backdrop = el => {
      for (let node = el; node != null; node = node.parentElement) {
        const value = luminance(getComputedStyle(node).backgroundColor);
        if (value != null) return value;
      }
      return luminance(getComputedStyle(document.documentElement).backgroundColor) ?? 1;
    };
    const failures = [];
    for (const el of document.querySelectorAll("body *")) {
      const text = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join("");
      if (text.length === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
        continue;
      }
      if (el.getBoundingClientRect().width === 0) continue;
      const fg = luminance(style.color);
      if (fg == null) continue;
      const bg = backdrop(el);
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      // 3:1 is the large-text floor; anything under it is a real regression
      // rather than a borderline body-copy tier.
      if (ratio < 3) {
        failures.push({
          text: text.slice(0, 40),
          ratio: Number(ratio.toFixed(2)),
          color: style.color,
          bg: getComputedStyle(el).backgroundColor,
          fgLum: Number(fg.toFixed(4)),
          bgLum: Number(bg.toFixed(4)),
        });
      }
    }
    return failures;`),
  );

// Never measure colors mid-transition: hover styling puts `transition-colors` on
// a lot of elements, and reading during one yields interpolated values that look
// exactly like a contrast bug. The theme flip itself is transition-suppressed
// (globals.css), so this only has to drain incidental animations.
const settleColors = async page => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))),
  );
};

const auditContrast = async (page, label) => {
  await settleColors(page);
  const failures = await lowContrastText(page);
  assert(failures.length === 0, `no text under 3:1 on ${label} (${JSON.stringify(failures)})`);
};

// Card art must never be tinted or filtered by the theme: the art IS the
// product, and a dark-mode filter would misrepresent it.
const auditArtUntouched = async (page, label) => {
  const filtered = await page.evaluate(() =>
    Array.from(document.images)
      .map(img => ({ src: img.src, filter: getComputedStyle(img).filter, opacity: getComputedStyle(img).opacity }))
      .filter(i => (i.filter !== "none" && i.filter !== "") || Number(i.opacity) < 1)
      .map(i => i.src),
  );
  assert(filtered.length === 0, `no filtered/dimmed card art on ${label} (${filtered.join(", ")})`);
};

// =============================================================================
// The surface guard (issue #59).
//
// `bodyLightness` above reads document.body, which is NOT enough: a child
// container carrying a hardcoded color paints OVER a correctly themed body, so
// the body assertion passes while every pixel the user sees is the wrong
// theme. The guard below therefore works on what is actually on screen, two
// ways, and both must hold for every surface in both themes:
//
//   A. PAINTED PIXELS. Take a real screenshot, decode it in the page on a
//      canvas, and sample the page's left and right gutter columns down the
//      full scroll height. Those columns are page background on every layout
//      (content is a centered max-w-content column), so they are the honest
//      answer to "what theme is on screen", whatever the DOM claims.
//   B. THE OUTERMOST VISIBLE CONTAINER. Hit-test a grid of viewport points and
//      walk up from each hit to the first ancestor painting an opaque
//      background. That is the container the user's eye reads at that point,
//      and it names the offending element when the pixel check trips.
//
// STAGE surfaces (the midnight hero, the zoom lightbox) are
// fixed near-black by design in BOTH themes, so they carry `data-stage` and are
// excluded from both checks rather than being special-cased by selector here.
// =============================================================================

const stageRegions = page =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-stage]")).map(el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
    }),
  );

// A. Painted pixels, sampled off a real screenshot.
const paintedGutterFailures = async (page, expected) => {
  const regions = await stageRegions(page);
  const screenshot = (await page.screenshot({ fullPage: true })).toString("base64");
  return page.evaluate(
    async ({ screenshot, regions, expected }) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${screenshot}`)).blob(),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      // The screenshot is in DEVICE pixels; every rect above is in CSS pixels.
      const scale = bitmap.width / document.documentElement.scrollWidth;
      const channel = s => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
      const sample = (cssX, cssY) => {
        const { data } = ctx.getImageData(Math.round(cssX * scale), Math.round(cssY * scale), 1, 1);
        const [r, g, b] = [data[0] / 255, data[1] / 255, data[2] / 255];
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const width = document.documentElement.scrollWidth;
      const height = document.documentElement.scrollHeight;
      const inStage = y => regions.some(region => y >= region.top - 1 && y <= region.bottom + 1);
      const failures = [];
      for (let y = 4; y < height - 4; y += 24) {
        if (inStage(y)) continue;
        for (const x of [3, width - 4]) {
          const lum = sample(x, y);
          const wrong = expected === "dark" ? lum > 0.3 : lum < 0.7;
          if (wrong) failures.push({ x, y, lum: Number(lum.toFixed(3)) });
        }
      }
      return failures;
    },
    { screenshot, regions, expected },
  );
};

// B. The outermost visible container under a grid of points.
const paintedContainerFailures = (page, expected) =>
  page.evaluate(
    new Function(
      "expected",
      `${COLOR_HELPERS}
      const isStage = el => el.closest("[data-stage]") != null;
      const describe = el => {
        let out = el.tagName.toLowerCase();
        if (el.id) out += "#" + el.id;
        if (typeof el.className === "string" && el.className.trim() !== "") {
          out += "." + el.className.trim().split(/\\s+/).slice(0, 5).join(".");
        }
        return out;
      };
      const failures = [];
      const seen = new Set();
      for (let x = 8; x < window.innerWidth; x += Math.max(40, Math.floor(window.innerWidth / 12))) {
        for (let y = 8; y < window.innerHeight; y += Math.max(40, Math.floor(window.innerHeight / 12))) {
          const hit = document.elementFromPoint(x, y);
          if (hit == null || isStage(hit)) continue;
          // Card art legitimately paints any color; the surface BEHIND it is
          // what has to follow the theme.
          let node = hit;
          while (node != null && (node.tagName === "IMG" || luminance(getComputedStyle(node).backgroundColor) == null)) {
            node = node.parentElement;
          }
          if (node == null || isStage(node)) continue;
          // Only SURFACE-sized elements are judged. Small inverse controls (the
          // ink-filled CTA, the avatar disc, a selected pill) are deliberately
          // counter-theme design, whereas a container big enough to be read as
          // "the page" is the thing this guard exists to catch.
          const rect = node.getBoundingClientRect();
          if (rect.width * rect.height < window.innerWidth * window.innerHeight * 0.2) continue;
          const lum = luminance(getComputedStyle(node).backgroundColor);
          const wrong = expected === "dark" ? lum > 0.3 : lum < 0.7;
          if (!wrong) continue;
          const key = describe(node);
          if (seen.has(key)) continue;
          seen.add(key);
          failures.push({ el: key, bg: getComputedStyle(node).backgroundColor, lum: Number(lum.toFixed(3)) });
        }
      }
      return failures;`,
    ),
    expected,
  );

// `gutters: false` is for the one layout where card art legitimately reaches
// the page edge (the focus carousel's full-bleed scroll strip): art pixels are
// any color, so the gutter sampler would flag them; the container check still
// guards every real surface behind the strip.
const auditPaintedTheme = async (page, label, expected, { gutters = true } = {}) => {
  await settleColors(page);
  const containers = await paintedContainerFailures(page, expected);
  assert(
    containers.length === 0,
    `no container paints the wrong theme on ${label} (expected ${expected}: ${JSON.stringify(containers)})`,
  );
  if (!gutters) return;
  const pixels = await paintedGutterFailures(page, expected);
  assert(
    pixels.length === 0,
    `screenshot pixels are ${expected} on ${label} (${pixels.length} wrong samples: ${JSON.stringify(pixels.slice(0, 5))})`,
  );
};

const SURFACES = [
  { path: "/", name: "landing", ready: null },
  { path: "/search?mode=name&q=charizard", name: "search", ready: "result-summary" },
  // The faceted state: rail selection + an applied type chip, which wears its
  // energy type's color triple in both themes (issue #46's game-native coding),
  // so the contrast audit covers the type ramps too.
  { path: "/search?mode=name&q=charizard&type=Fire", name: "search-faceted", ready: "result-summary", prefix: "issue-46-theme" },
  { path: "/search", name: "search-prompt", ready: null },
  { path: "/search?mode=name&q=zzzzzznotacard", name: "search-empty", ready: "search-empty" },
  { path: "/login", name: "login", ready: null },
  { path: "/signup", name: "signup", ready: null },
  { path: "/nope-this-does-not-exist", name: "404", ready: null },
];

const run = async () => {
  const browser = await chromium.launch();

  // ---- 1. system default: dark OS, no cookie, no attribute -----------------
  const darkContext = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await darkContext.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

  assert(await cookieValue(darkContext) === null, "no theme cookie is set by default");
  assert(await themeAttr(page) === null, "no data-theme attribute in system mode");
  assert(await isDark(page), "system default with a dark OS renders the dark theme");
  await auditContrast(page, "landing (system dark)");
  await auditPaintedTheme(page, "landing (system dark)", "dark");
  await auditArtUntouched(page, "landing (system dark)");

  // ---- 2. system-change reactivity, no reload -----------------------------
  await page.emulateMedia({ colorScheme: "light" });
  assert(await isLight(page), "flipping the OS preference re-themes the live page");
  assert(await themeAttr(page) === null, "system mode still sets no attribute after the flip");
  await page.emulateMedia({ colorScheme: "dark" });
  assert(await isDark(page), "flipping the OS preference back re-themes the live page");

  // ---- 3. toggle round-trip + persistence across reload -------------------
  await page.getByTestId("theme-toggle").waitFor();
  await page.getByTestId("theme-light").click();
  assert(await isLight(page), "choosing Light re-themes instantly while the OS is dark");
  // The flip must be instant, not animated: no element may still be mid-
  // transition on the frame after the switch, or the page passes through an
  // unreadable half-themed state.
  assert(
    (await page.evaluate(() => document.getAnimations().length)) === 0,
    "the theme flip runs no transitions (instant repaint, not a cross-fade)",
  );
  assert(await themeAttr(page) === "light", 'data-theme="light" is applied live');
  assert(await cookieValue(darkContext) === "light", "the Light choice is persisted to the cookie");

  await page.reload({ waitUntil: "networkidle" });
  assert(await isLight(page), "the Light override survives a reload");
  assert(await themeAttr(page) === "light", "the reloaded document carries data-theme=light");
  assert(
    await page.getByTestId("theme-light").getAttribute("aria-pressed") === "true",
    "the toggle rehydrates on the persisted choice",
  );

  // ---- 4. no flash: the SERVER already stamped the theme ------------------
  const raw = await page.request.get(`${BASE_URL}/`, { headers: { cookie: "theme=dark" } });
  const html = await raw.text();
  assert(
    /<html[^>]*data-theme="dark"/.test(html),
    "server-rendered HTML carries data-theme before any JS runs (no flash)",
  );
  // A FRESH context, because `page.request` shares this context's cookie jar,
  // which now carries the Light override we just set.
  const cleanContext = await browser.newContext();
  const rawSystem = await cleanContext.request.get(`${BASE_URL}/`);
  assert(
    !/<html[^>]*data-theme=/.test(await rawSystem.text()),
    "server-rendered HTML omits data-theme with no cookie (system mode)",
  );
  await cleanContext.close();

  // ---- 5. back to System hands control to the OS again --------------------
  await page.getByTestId("theme-system").click();
  assert(await themeAttr(page) === null, "choosing System removes the attribute");
  assert(await cookieValue(darkContext) === "system", "the System choice is persisted too");
  assert(await isDark(page), "System follows the dark OS preference again");

  // ---- the proof set: both themes, every surface, desktop + mobile --------
  for (const theme of ["light", "dark"]) {
    await page.getByTestId(`theme-${theme}`).click();

    // The header is the toggle's home and the tightest layout on the site, so
    // it gets its own crop at 390px: the nav must stay on ONE line.
    await page.setViewportSize(MOBILE);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const header = page.locator("header");
    const box = await header.boundingBox();
    assert(box.height < 64, `header stays one line at 390px in ${theme} (${box.height}px)`);
    await page.screenshot({
      path: join(SHOTS_DIR, `issue-57-header-${theme}-mobile.png`),
      clip: box,
    });
    console.log(`captured issue-57-header-${theme}-mobile.png`);
    await page.setViewportSize(DESKTOP);

    for (const surface of SURFACES) {
      await page.goto(`${BASE_URL}${surface.path}`, { waitUntil: "networkidle" });
      if (surface.ready != null) await page.getByTestId(surface.ready).waitFor();
      await auditContrast(page, `${surface.name} (${theme})`);
      await auditPaintedTheme(page, `${surface.name} (${theme}) desktop`, theme);
      await auditArtUntouched(page, `${surface.name} (${theme})`);
      await page.setViewportSize(DESKTOP);
      await shot(page, `${surface.name}-${theme}-desktop`, surface.prefix ?? "issue-57");
      await page.setViewportSize(MOBILE);
      // Mobile is a separate risk: gutters collapse and some containers only
      // exist below the sm breakpoint, so it gets its own painted-pixel pass.
      await auditPaintedTheme(page, `${surface.name} (${theme}) mobile`, theme);
      await shot(page, `${surface.name}-${theme}-mobile`, surface.prefix ?? "issue-57");
      await page.setViewportSize(DESKTOP);
    }

    // Card detail needs a real id, taken from the search results grid.
    await page.goto(`${BASE_URL}/search?mode=name&q=charizard`, { waitUntil: "networkidle" });
    await page.getByTestId("result-summary").waitFor();
    const href = await page.locator('a[href^="/card/"]').first().getAttribute("href");
    await page.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle" });
    await auditContrast(page, `card detail (${theme})`);
    await auditPaintedTheme(page, `card detail (${theme})`, theme);
    await auditArtUntouched(page, `card detail (${theme})`);
    await shot(page, `detail-${theme}-desktop`);
    await page.setViewportSize(MOBILE);
    await shot(page, `detail-${theme}-mobile`);
    await page.setViewportSize(DESKTOP);

    // The zoom lightbox is a stage surface: it must look identical in both.
    await page.getByTestId("art-zoom-open").click();
    await page.getByTestId("art-zoom-overlay").waitFor();
    await shot(page, `zoom-${theme}-desktop`);
    await page.keyboard.press("Escape");
  }

  // ---- authenticated surfaces: account, saves (grid + carousel), decks ----
  // The saves/deck surfaces (issue #46) only render with real data, so this
  // takes a real signup, hearts three cards, and builds a deck holding one
  // before auditing every logged-in surface in both themes.
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.fill("#email", `theme+${Date.now()}@example.com`);
  await page.fill("#password", "supersecret1");
  await page.fill("#confirm", "supersecret1");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/account");

  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  const heartButtons = page.locator('[data-testid^="fav-"]');
  await heartButtons.first().waitFor();
  const savedIds = [];
  for (let i = 0; i < 3; i++) {
    savedIds.push((await heartButtons.nth(i).getAttribute("data-testid")).replace("fav-", ""));
  }
  for (const cardId of savedIds) {
    await clickAction(page, page.getByTestId(`fav-${cardId}`));
    await page.waitForSelector(`[data-testid="fav-${cardId}"][data-saved="true"]`);
  }

  await page.goto(`${BASE_URL}/decks`, { waitUntil: "networkidle" });
  await page.getByTestId("deck-create-name").fill("Theme Proof");
  await clickAction(page, page.getByTestId("deck-create-submit"));
  const deckLink = page.locator('[data-testid^="deck-link-"]').first();
  await deckLink.waitFor();
  const deckId = (await deckLink.getAttribute("data-testid")).replace("deck-link-", "");
  await page.goto(`${BASE_URL}/search?q=charizard`, { waitUntil: "networkidle" });
  await page.getByTestId(`deck-menu-${savedIds[0]}`).click();
  await clickAction(page, page.getByTestId(`deck-add-${deckId}-${savedIds[0]}`));

  for (const theme of ["light", "dark"]) {
    await page.goto(`${BASE_URL}/account`, { waitUntil: "networkidle" });
    await page.getByTestId(`theme-${theme}`).click();
    await auditContrast(page, `account (${theme})`);
    await auditPaintedTheme(page, `account (${theme})`, theme);
    await shot(page, `account-${theme}-desktop`);

    // Saves: the workhorse grid plus the facet rail, desktop and mobile.
    await page.goto(`${BASE_URL}/saves`, { waitUntil: "networkidle" });
    await page.locator('[data-testid^="card-tile-"]').first().waitFor();
    await auditContrast(page, `saves (${theme})`);
    await auditPaintedTheme(page, `saves (${theme}) desktop`, theme);
    await auditArtUntouched(page, `saves (${theme})`);
    await shot(page, `saves-${theme}-desktop`, "issue-46-theme");
    await page.setViewportSize(MOBILE);
    await auditPaintedTheme(page, `saves (${theme}) mobile`, theme);
    await shot(page, `saves-${theme}-mobile`, "issue-46-theme");
    await page.setViewportSize(DESKTOP);

    // The focus carousel, the retained alternate view. Its full-bleed strip
    // puts card art in the gutters, so the pixel sampler sits this one out.
    await page.getByTestId("view-carousel").click();
    await page.getByTestId("carousel-placard").waitFor();
    await auditContrast(page, `saves carousel (${theme})`);
    await auditPaintedTheme(page, `saves carousel (${theme})`, theme, { gutters: false });
    await shot(page, `saves-carousel-${theme}-desktop`, "issue-46-theme");

    // The deck ledger and a populated deck detail (grid + facets + manage).
    await page.goto(`${BASE_URL}/decks`, { waitUntil: "networkidle" });
    await page.locator('[data-testid^="deck-link-"]').first().waitFor();
    await auditContrast(page, `decks (${theme})`);
    await auditPaintedTheme(page, `decks (${theme})`, theme);
    await shot(page, `decks-${theme}-desktop`, "issue-46-theme");

    await page.goto(`${BASE_URL}/decks/${deckId}`, { waitUntil: "networkidle" });
    await page.locator('[data-testid^="card-tile-"]').first().waitFor();
    await auditContrast(page, `deck detail (${theme})`);
    await auditPaintedTheme(page, `deck detail (${theme}) desktop`, theme);
    await auditArtUntouched(page, `deck detail (${theme})`);
    await shot(page, `deck-${theme}-desktop`, "issue-46-theme");
    await page.setViewportSize(MOBILE);
    await auditPaintedTheme(page, `deck detail (${theme}) mobile`, theme);
    await shot(page, `deck-${theme}-mobile`, "issue-46-theme");
    await page.setViewportSize(DESKTOP);
  }

  await browser.close();
  console.log("theme-flows: done");
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
