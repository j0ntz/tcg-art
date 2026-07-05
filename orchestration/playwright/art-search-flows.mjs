// Drive the semantic art search end to end: realistic free-text queries
// against the running app, assertions on the ranked results (via the
// /api/art-search JSON surface), and proof screenshots of the results grid
// into docs/screenshots/ (desktop 1440x900 and mobile 390x844).
//
//   BASE_URL=http://localhost:3000 node orchestration/playwright/art-search-flows.mjs
//   BASE_URL=https://<preview>.vercel.app node orchestration/playwright/art-search-flows.mjs
//
// Each query carries an expectation tier:
//   - MUST: known-answer cases; a miss fails the run (exit 1).
//   - SOFT: semantically desirable; misses are reported honestly but do not
//     fail the run (the committed index is metadata-derived stub rows until a
//     human provisions ANTHROPIC_API_KEY; scene/weather phrasing has limited
//     signal until then — see docs/semantic-search-design.md).
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(HERE, "..", "..", "docs", "screenshots");

// expect: case-insensitive regexes; the query passes when at least one of the
// top `inTop` result names matches any of them.
// beats (optional): regexes the FIRST expect hit must outrank. The case fails
// when any beats pattern appears ABOVE the first expect hit anywhere in the
// ranked results (encodes "attribute-coverage winners outrank single-token
// frequency losers" for the multi-attribute regression probes).
const QUERIES = [
  { slug: "q01-pikachu-surfing", q: "pikachu surfing", tier: "MUST", inTop: 3, expect: [/surfing pikachu/i] },
  { slug: "q02-surfing-pikachu", q: "surfing pikachu", tier: "MUST", inTop: 3, expect: [/surfing pikachu/i] },
  { slug: "q03-riding-a-wave", q: "pikachu riding a wave", tier: "MUST", inTop: 5, expect: [/surfing pikachu/i] },
  { slug: "q04-red-dragon-volcano", q: "red dragon over a volcano", tier: "MUST", inTop: 5, expect: [/charizard/i] },
  { slug: "q05-yellow-electric-mouse", q: "yellow electric mouse", tier: "MUST", inTop: 5, expect: [/pikachu/i, /raichu/i] },
  { slug: "q06-blue-turtle-shell", q: "blue turtle with a shell", tier: "MUST", inTop: 5, expect: [/squirtle/i, /wartortle/i, /blastoise/i] },
  { slug: "q07-spooky-purple-ghost", q: "spooky purple ghost", tier: "MUST", inTop: 5, expect: [/gastly/i, /haunter/i, /gengar/i] },
  { slug: "q08-sad-ghost-rain", q: "sad ghost in the rain", tier: "MUST", inTop: 10, expect: [/gastly/i, /haunter/i, /gengar/i] },
  // Multi-attribute coverage regression probes (issue #31): a row matching more
  // distinct query attributes must beat one that matches a single high-frequency
  // token very strongly.
  {
    slug: "q13-tiny-yellow-bird-snow",
    q: "tiny yellow bird in a snowstorm",
    tier: "MUST",
    inTop: 3,
    // Small and/or yellow birds; must outrank large brown birds and Moltres.
    expect: [/spearow/i, /natu/i, /doduo/i, /zapdos/i],
    beats: [/moltres/i, /pidgeot/i, /pidgeotto/i, /fearow/i],
  },
  {
    slug: "q14-angry-orange-dragon-fire",
    q: "angry orange dragon breathing fire",
    tier: "MUST",
    inTop: 3,
    expect: [/charizard/i, /charmeleon/i],
  },
  {
    slug: "q15-sad-ghost-train",
    q: "sad ghost on a train",
    tier: "MUST",
    inTop: 5,
    // No train art exists in the index; the ghost line must still be the top,
    // graceful result rather than train-adjacent garbage.
    expect: [/gastly/i, /haunter/i, /gengar/i],
  },
  { slug: "q09-fiery-flame-bird", q: "fiery flame bird", tier: "SOFT", inTop: 10, expect: [/moltres/i] },
  { slug: "q10-psychic-moon", q: "mysterious psychic under the full moon", tier: "SOFT", inTop: 10, expect: [/gengar/i, /mewtwo/i, /abra/i, /alakazam/i, /clefairy/i] },
  { slug: "q11-sleeping", q: "sleeping pokemon", tier: "SOFT", inTop: 10, expect: [/snorlax/i, /abra/i, /jigglypuff/i, /slowpoke/i] },
  { slug: "q12-green-bug-forest", q: "green bug in the forest", tier: "SOFT", inTop: 10, expect: [/caterpie/i, /weedle/i, /metapod/i, /kakuna/i, /pinsir/i, /butterfree/i] },
];

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

const shot = async (page, name) => {
  await settleImages(page);
  await page.screenshot({ path: join(SHOTS_DIR, name), fullPage: true, type: "jpeg", quality: 78 });
  console.log(`captured ${name}`);
};

const run = async () => {
  // API assertions first: the ranked results as JSON.
  const failures = [];
  const report = [];
  for (const spec of QUERIES) {
    const res = await fetch(`${BASE_URL}/api/art-search?q=${encodeURIComponent(spec.q)}`);
    if (!res.ok) throw new Error(`api ${res.status} for "${spec.q}"`);
    const body = await res.json();
    const top = body.results.slice(0, spec.inTop);
    const hit = top.find(result => spec.expect.some(pattern => pattern.test(result.name)));

    // "outranks" check: the first expect hit (anywhere in the ranked list) must
    // sit above the first beats loser. A loser ranked above the winner fails.
    let outrankOk = true;
    let outrankNote = "";
    if (spec.beats != null) {
      const firstHitIdx = body.results.findIndex(result => spec.expect.some(pattern => pattern.test(result.name)));
      const firstBeatIdx = body.results.findIndex(result => spec.beats.some(pattern => pattern.test(result.name)));
      outrankOk = firstHitIdx >= 0 && (firstBeatIdx < 0 || firstHitIdx < firstBeatIdx);
      const winner = firstHitIdx >= 0 ? `${body.results[firstHitIdx].name}@${firstHitIdx + 1}` : "(none)";
      const loser = firstBeatIdx >= 0 ? `${body.results[firstBeatIdx].name}@${firstBeatIdx + 1}` : "(none)";
      outrankNote = ` outranks:${outrankOk ? "OK" : "FAIL"} (${winner} vs ${loser})`;
    }

    const pass = hit != null && outrankOk;
    const topNames = top.map(result => `${result.name} (${result.score.toFixed(1)})`).join(", ");
    const line = `${spec.tier} ${pass ? "HIT " : "MISS"} "${spec.q}" [mode=${body.mode}] top${spec.inTop}: ${topNames || "(none)"}${outrankNote}`;
    report.push(line);
    console.log(line);
    if (!pass && spec.tier === "MUST") failures.push(spec.q);
  }

  // Guardrails: empty/nonsense queries return nothing rather than noise.
  const nonsense = await (await fetch(`${BASE_URL}/api/art-search?q=zzqx%20vvblorp`)).json();
  if (nonsense.results.length !== 0) failures.push("nonsense query returned results");
  console.log(`guardrail: nonsense query -> ${nonsense.results.length} results`);
  const empty = await (await fetch(`${BASE_URL}/api/art-search?q=`)).json();
  if (empty.results.length !== 0) failures.push("empty query returned results");
  console.log(`guardrail: empty query -> ${empty.results.length} results`);

  // Pixel proof: the rendered results grid for every query, desktop + mobile.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  for (const spec of QUERIES) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/search?q=${encodeURIComponent(spec.q)}`, { waitUntil: "networkidle" });
    await page.getByTestId("result-summary").waitFor();
    await shot(page, `issue-27-${spec.slug}.jpg`);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, `issue-27-${spec.slug}-mobile.jpg`);
  }

  // Mode toggle round-trip: name mode still serves the exhaustive name search.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/search?mode=name&q=charizard`, { waitUntil: "networkidle" });
  await page.getByTestId("result-summary").waitFor();
  const nameCount = await page.locator('[data-testid^="art-result-"]').count();
  if (nameCount < 10) failures.push(`name mode returned only ${nameCount} charizard results`);
  console.log(`name mode: ${nameCount} charizard results`);
  await shot(page, "issue-27-name-mode-fallback.jpg");
  await browser.close();

  console.log("\n--- summary ---");
  for (const line of report) console.log(line);
  if (failures.length > 0) {
    console.error(`\nart-search-flows: ${failures.length} MUST failure(s): ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("\nart-search-flows: all MUST cases passed");
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
