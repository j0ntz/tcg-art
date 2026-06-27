// Drive the /signup flow with Playwright and capture three screenshots:
// empty form, a validation-error state, and the success state.
//
// Usage: BASE_URL=https://<preview>.vercel.app node orchestration/playwright/signup-screens.mjs
// Defaults to http://localhost:3000 for local runs.
// Screenshots are written to docs/screenshots/ (1440-wide viewport, deviceScaleFactor 2).
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = join(HERE, "..", "..", "docs", "screenshots");

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1) Empty form.
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create Account" }).waitFor();
  await page.screenshot({ path: join(SHOTS_DIR, "signup-empty.png"), fullPage: true });
  console.log("captured signup-empty.png");

  // 2) Validation errors: bad email, short password, mismatched confirm.
  await page.locator("#email").fill("not-an-email");
  await page.locator("#password").fill("short");
  await page.locator("#confirm").fill("different");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("alert").first().waitFor();
  await page.screenshot({ path: join(SHOTS_DIR, "signup-error.png"), fullPage: true });
  console.log("captured signup-error.png");

  // 3) Valid submit -> success state.
  await page.locator("#email").fill("collector@example.com");
  await page.locator("#password").fill("supersecret1");
  await page.locator("#confirm").fill("supersecret1");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByTestId("signup-success").waitFor();
  await page.screenshot({ path: join(SHOTS_DIR, "signup-success.png"), fullPage: true });
  console.log("captured signup-success.png");

  await browser.close();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
