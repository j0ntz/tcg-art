// Capture a FAITHFUL mobile-viewport screenshot of a URL.
//
// Why this exists: headless Chrome clamps its minimum window width to ~500px, so
// `--window-size=390,844 --screenshot` does NOT render a real phone layout. It
// lays out at 500px and then crops the PNG to 390px, which clips the right edge
// and misrepresents mobile as overflowing. This drives Chrome over the DevTools
// Protocol and uses Emulation.setDeviceMetricsOverride (the same mechanism
// browser devtools "device toolbar" uses), which honors widths below 500px and
// renders a true mobile layout.
//
// Usage: node screenshot-mobile.mjs <url> <out.png> [width=390] [height=844]
// Deps: none beyond Node's built-in WebSocket (Node >= 22) and a local Chrome.
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , url, outPath, widthArg, heightArg] = process.argv;
if (url == null || outPath == null) {
  console.error("usage: node screenshot-mobile.mjs <url> <out.png> [width] [height]");
  process.exit(2);
}
const width = Number(widthArg ?? 390);
const height = Number(heightArg ?? 844);

if (typeof WebSocket === "undefined") {
  console.error("ERROR: this Node has no global WebSocket (need Node >= 22). Cannot capture mobile screenshot.");
  process.exit(3);
}

const CHROME =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Pick a port from a wide range with per-run entropy (pid + randomness) so
// concurrent verify runs do not collide on the same DevTools port.
const PORT = 10000 + ((process.pid + Math.floor(Math.random() * 50000)) % 50000);
const profileDir = mkdtempSync(join(tmpdir(), "cdp-mobile-"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
]);

const fail = (msg, code = 1) => {
  console.error(msg);
  try { chrome.kill(); } catch {}
  process.exit(code);
};

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl != null) return j.webSocketDebuggerUrl;
    } catch {
      // devtools endpoint not up yet
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint never came up");
}

let ws;
try {
  ws = new WebSocket(await getWsUrl());
} catch (e) {
  fail(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
}

let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id != null && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
await new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", () => rej(new Error("ws error")));
});

function send(method, params = {}, sessionId) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const { result: targets } = await send("Target.getTargets");
const page = targets.targetInfos.find((t) => t.type === "page");
if (page == null) fail("ERROR: no page target");
const { result: att } = await send("Target.attachToTarget", {
  targetId: page.targetId,
  flatten: true,
});
const sessionId = att.sessionId;

await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
// True phone viewport: mobile flag + dpr 3 so layout matches an iPhone-class device.
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 3,
  mobile: true,
}, sessionId);

await send("Page.navigate", { url }, sessionId);
// Wait for the document AND its images (the showcase fan loads art client-side)
// to actually finish, polling instead of guessing with a fixed sleep. Cap at ~6s
// so a stuck asset can't hang the run.
const readyExpr = `document.readyState === "complete" && [...document.images].every((i) => i.complete)`;
const readyDeadline = Date.now() + 6000;
while (Date.now() < readyDeadline) {
  const { result: ready } = await send("Runtime.evaluate", {
    expression: readyExpr,
    returnByValue: true,
  }, sessionId);
  if (ready.result.value === true) break;
  await sleep(150);
}

// Assert there is no horizontal overflow at this true mobile width, and report it.
const overflowExpr = `JSON.stringify({
  innerWidth: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  overflowBy: document.documentElement.scrollWidth - document.documentElement.clientWidth
})`;
const { result: ov } = await send("Runtime.evaluate", {
  expression: overflowExpr,
  returnByValue: true,
}, sessionId);
console.error(`MOBILE_LAYOUT=${ov.result.value}`);
const overflowBy = JSON.parse(ov.result.value).overflowBy;

const { result: shot } = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
}, sessionId);
writeFileSync(outPath, Buffer.from(shot.data, "base64"));
console.log(outPath);

try { ws.close(); } catch {}
try { chrome.kill(); } catch {}
// Self-gate: write the proof screenshot first (above), then fail the run if the
// page actually overflows its true mobile width. This lets verify-preview.sh flip
// RESULT=fail on a real mobile overflow instead of silently passing.
process.exit(overflowBy > 0 ? 1 : 0);
