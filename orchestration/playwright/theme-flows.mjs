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

const shot = async (page, name) => {
  await settleImages(page);
  await page.screenshot({ path: join(SHOTS_DIR, `issue-57-${name}.png`), fullPage: true });
  console.log(`captured issue-57-${name}.png`);
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

const SURFACES = [
  { path: "/", name: "landing", ready: null },
  { path: "/search?mode=name&q=charizard", name: "search", ready: "result-summary" },
  { path: "/login", name: "login", ready: null },
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
      await auditArtUntouched(page, `${surface.name} (${theme})`);
      await page.setViewportSize(DESKTOP);
      await shot(page, `${surface.name}-${theme}-desktop`);
      await page.setViewportSize(MOBILE);
      await shot(page, `${surface.name}-${theme}-mobile`);
      await page.setViewportSize(DESKTOP);
    }

    // Card detail needs a real id, taken from the search results grid.
    await page.goto(`${BASE_URL}/search?mode=name&q=charizard`, { waitUntil: "networkidle" });
    await page.getByTestId("result-summary").waitFor();
    const href = await page.locator('a[href^="/card/"]').first().getAttribute("href");
    await page.goto(`${BASE_URL}${href}`, { waitUntil: "networkidle" });
    await auditContrast(page, `card detail (${theme})`);
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

  // ---- authenticated surfaces: account + the binder's three modes ---------
  // The Night Gallery is the riskiest surface in a theming change: it is a
  // STAGE (fixed near-black) whose picture frames hold a white mat and placard,
  // so its text must follow the mat, not the theme. A theme-following token in
  // there reads as white-on-white in light or dark. Worth a real signup.
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.fill("#email", `theme+${Date.now()}@example.com`);
  await page.fill("#password", "supersecret1");
  await page.fill("#confirm", "supersecret1");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/account");

  await page.goto(`${BASE_URL}/search?mode=name&q=charizard`, { waitUntil: "networkidle" });
  await page.getByTestId("result-summary").waitFor();
  await page.locator('[data-testid^="add-"]').first().click();
  await page.waitForLoadState("networkidle");

  for (const theme of ["light", "dark"]) {
    await page.goto(`${BASE_URL}/account`, { waitUntil: "networkidle" });
    await page.getByTestId(`theme-${theme}`).click();
    await auditContrast(page, `account (${theme})`);
    await shot(page, `account-${theme}-desktop`);

    await page.goto(`${BASE_URL}/binder`, { waitUntil: "networkidle" });
    await page.getByTestId("binder-pages").waitFor();
    await auditContrast(page, `binder (${theme})`);
    await auditArtUntouched(page, `binder (${theme})`);
    await shot(page, `binder-${theme}-desktop`);

    await page.getByTestId("mode-gallery").click();
    await page.getByTestId("night-gallery").waitFor();
    await auditContrast(page, `night gallery (${theme})`);
    await auditArtUntouched(page, `night gallery (${theme})`);
    await shot(page, `gallery-${theme}-desktop`);
    await page.setViewportSize(MOBILE);
    await shot(page, `gallery-${theme}-mobile`);
    await page.setViewportSize(DESKTOP);
  }

  await browser.close();
  console.log("theme-flows: done");
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
