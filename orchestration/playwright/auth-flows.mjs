// Drive the real auth flows with Playwright and capture proof screenshots
// into docs/screenshots/ (1440-wide viewport, deviceScaleFactor 2).
//
// Full mode (default; expects `next dev`, where the PGlite fallback enables
// the credentials flow):
//   node orchestration/playwright/auth-flows.mjs
//   - signup (fresh timestamped email) -> lands logged-in on /account
//   - session persists across reload and new page
//   - logout -> logged-out header
//   - login with wrong password -> server error banner
//   - login with right password -> /account
//   - /account while logged out -> server-side redirect to /login
//   - GOOGLE_BOUNDARY=1: click "Continue with Google" and assert the redirect
//     reaches accounts.google.com (needs dummy AUTH_GOOGLE_ID/SECRET on the
//     server; Google then rejects the client, which is expected)
//
// Degraded mode (expects a production server with NO auth env vars):
//   MODE=degraded BASE_URL=http://localhost:3001 node orchestration/playwright/auth-flows.mjs
//   - /signup renders with both providers disabled + runbook hints
//   - /api/auth/session answers 503 instead of crashing
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MODE = process.env.MODE ?? "full";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(HERE, "..", "..", "docs", "screenshots");

const shot = async (page, name) => {
  await page.screenshot({ path: join(SHOTS_DIR, name), fullPage: true });
  console.log(`captured ${name}`);
};

const assert = (cond, message) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`ok: ${message}`);
};

const runDegraded = async page => {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  assert(await page.locator("#email").isDisabled(), "email field disabled without env vars");
  assert(
    await page.getByRole("button", { name: "Create Account" }).isDisabled(),
    "submit disabled without env vars",
  );
  assert(
    (await page.getByRole("status").count()) >= 2,
    "both provider hints visible without env vars",
  );
  await shot(page, "issue-14-signup-degraded.png");
  const res = await page.request.get(`${BASE_URL}/api/auth/session`);
  assert(res.status() === 503, `/api/auth/session degrades with 503 (got ${res.status()})`);
};

const runFull = async page => {
  const email = `collector+${Date.now()}@example.com`;
  const password = "supersecret1";

  // Sign-up: client validation first, then the real thing.
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await shot(page, "issue-14-signup.png");
  await page.locator("#email").fill("not-an-email");
  await page.locator("#password").fill("short");
  await page.locator("#confirm").fill("different");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("alert").first().waitFor();
  await shot(page, "issue-14-signup-validation.png");

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(`${BASE_URL}/account`);
  const shownName = await page.getByTestId("account-name").textContent();
  assert(shownName === email, `signup landed on /account as ${email}`);
  await shot(page, "issue-14-account.png");

  // Session persists across a reload; the shared header reflects it.
  await page.reload({ waitUntil: "domcontentloaded" });
  assert((await page.getByTestId("account-name").textContent()) === email, "session survives reload");
  await page.getByRole("link", { name: "Account" }).waitFor();
  assert(true, "header shows Account while logged in");

  // Logout lands on the marketing page, which renders server-side and waits
  // on the (slow, uncached-in-dev) card API; give it a generous timeout.
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("link", { name: "Log In" }).waitFor({ timeout: 90000 });
  assert(true, "logout returns a logged-out header");

  // Server-side gate: /account without a session redirects to /login.
  await page.goto(`${BASE_URL}/account`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/login/);
  assert(true, "/account redirects to /login when logged out");

  // Login: wrong password -> error banner; right password -> /account.
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("wrong-password");
  await page.getByRole("button", { name: "Log In" }).click();
  await page.getByTestId("auth-server-error").waitFor();
  await shot(page, "issue-14-login-error.png");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL(`${BASE_URL}/account`);
  assert((await page.getByTestId("account-name").textContent()) === email, "login works after logout");
  await shot(page, "issue-14-login-success.png");

  if (process.env.GOOGLE_BOUNDARY === "1") {
    // Prove the Google flow up to the external boundary: our server must
    // redirect the browser to accounts.google.com. Drop the session by
    // clearing cookies (the JWT session lives in a cookie) instead of another
    // slow round trip through the landing page.
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForURL(/accounts\.google\.com/);
    assert(true, "Google sign-in redirects to accounts.google.com");
    await shot(page, "issue-14-google-boundary.png");
  }
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  if (MODE === "degraded") {
    await runDegraded(page);
  } else {
    await runFull(page);
  }
  await browser.close();
  console.log(`auth-flows ${MODE} mode: all checks passed`);
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
