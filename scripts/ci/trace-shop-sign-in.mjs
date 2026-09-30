#!/usr/bin/env node
/**
 * Records redirect hops for shop sign-in flows (headless Chromium + Playwright).
 *
 * Usage:
 *   SHOP_TRACE_BASE_URL=https://test-shop.lax.bid \
 *   SHOP_TRACE_EMAIL=user1@lax.bid SHOP_TRACE_PASSWORD='…' \
 *   node scripts/ci/trace-shop-sign-in.mjs --scenario=checkout
 *
 * Scenarios: checkout | account | header | register | curl-error-loop
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const shopDir = join(repoRoot, "apps/shop");

const scenario = process.argv.find((a) => a.startsWith("--scenario="))?.split("=")[1] ?? "checkout";
const baseUrl = (process.env.SHOP_TRACE_BASE_URL ?? "https://test-shop.lax.bid").replace(
  /\/+$/,
  "",
);
const email = process.env.SHOP_TRACE_EMAIL ?? "user1@lax.bid";
const password = process.env.SHOP_TRACE_PASSWORD ?? "Password123!";
const maxHops = Number(process.env.SHOP_TRACE_MAX_HOPS ?? 15);
const verifyFix =
  process.argv.includes("--verify-fix") || process.env.SHOP_TRACE_VERIFY_FIX === "1";

function runPlaywrightTrace(body) {
  const result = spawnSync("pnpm", ["exec", "node", "--input-type=module", "-e", body], {
    cwd: shopDir,
    encoding: "utf8",
    env: {
      ...process.env,
      SHOP_TRACE_BASE_URL: baseUrl,
      SHOP_TRACE_EMAIL: email,
      SHOP_TRACE_PASSWORD: password,
      SHOP_TRACE_MAX_HOPS: String(maxHops),
      SHOP_TRACE_SCENARIO: scenario,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

if (scenario === "curl-error-loop") {
  const { spawnSync: spawn } = await import("node:child_process");
  spawn(
    "curl",
    [
      "-s",
      "-o",
      "/dev/null",
      "-b",
      "jar.txt",
      "-c",
      "jar.txt",
      `${baseUrl}/login?returnTo=%2Fcheckout`,
    ],
    {
      stdio: "inherit",
    },
  );
  let url = `${baseUrl}/auth/callback?error=access_denied`;
  const seen = new Set();
  for (let i = 1; i <= maxHops; i += 1) {
    const out = spawn(
      "curl",
      [
        "-s",
        "-o",
        "/dev/null",
        "-b",
        "jar.txt",
        "-c",
        "jar.txt",
        "-w",
        "%{http_code} %{redirect_url}",
        url,
      ],
      {
        encoding: "utf8",
      },
    );
    const line = (out.stdout ?? "").trim();
    const path = new URL(url).pathname + new URL(url).search;
    console.log(`${i} ${path} -> ${line}`);
    if (seen.has(path)) {
      console.error("FAIL: repeated path (redirect loop)");
      process.exit(1);
    }
    seen.add(path);
    const next = line.split(" ").slice(1).join(" ");
    if (!next || line.startsWith("200")) break;
    url = next;
  }
  const lastPath = [...seen].at(-1) ?? "";
  if (verifyFix && !lastPath.includes("/sign-in-error")) {
    console.error("FAIL: expected final path /sign-in-error after redirect fix");
    process.exit(4);
  }
  console.log(
    verifyFix
      ? "curl-error-loop verify OK (stopped at sign-in-error, no repeat)"
      : "curl-error-loop trace complete (no repeat within hop limit)",
  );
  process.exit(0);
}

const playwrightBody = `
import { chromium } from "@playwright/test";
const B = process.env.SHOP_TRACE_BASE_URL;
const scenario = process.env.SHOP_TRACE_SCENARIO;
const email = process.env.SHOP_TRACE_EMAIL;
const password = process.env.SHOP_TRACE_PASSWORD;
const maxHops = Number(process.env.SHOP_TRACE_MAX_HOPS);
const hops = [];
const seen = new Set();
function short(u) {
  try {
    return u.replace(B, "").replace("https://test-auth.lax.bid", "[auth]").slice(0, 140);
  } catch { return u; }
}
async function signInAtOp(page) {
  await page.locator("#email").fill(email);
  await page.locator("button[type=submit]:visible").first().click();
  await page.locator("#password").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#password").fill(password);
  await page.locator("button[type=submit]:visible").first().click();
}
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
ctx.on("response", async (r) => {
  const u = r.url();
  if (/_next\\/static|\\.woff|cdn-cgi/.test(u)) return;
  const loc = r.headers()["location"];
  if (r.status() >= 300 && r.status() < 400) {
    const key = short(u) + "->" + short(loc ?? "");
    hops.push(\`\${r.status()} \${short(u)} -> \${short(loc ?? "")}\`);
    if (seen.has(key)) hops.push("REPEAT:" + key);
    seen.add(key);
  }
});
try {
  if (scenario === "checkout") {
    await page.goto(B + "/artworks/harbor-print");
    await page.getByRole("button", { name: /add to basket/i }).click();
    await page.waitForTimeout(2000);
    await page.goto(B + "/checkout");
    await page.waitForURL(/test-auth\\.lax\\.bid/, { timeout: 20000 });
    await signInAtOp(page);
    await page.waitForTimeout(12000);
  } else if (scenario === "account") {
    await page.goto(B + "/account");
    await page.waitForURL(/test-auth\\.lax\\.bid|login/, { timeout: 20000 });
    if (!page.url().includes("test-auth")) await page.goto(B + "/login?returnTo=%2Faccount");
    await page.waitForURL(/test-auth\\.lax\\.bid/, { timeout: 20000 });
    await signInAtOp(page);
    await page.waitForTimeout(12000);
  } else if (scenario === "header") {
    await page.goto(B + "/artworks");
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await page.waitForURL(/test-auth\\.lax\\.bid/, { timeout: 20000 });
    await signInAtOp(page);
    await page.waitForTimeout(12000);
  } else if (scenario === "register") {
    await page.goto(B + "/register");
    await page.waitForURL(/test-auth\\.lax\\.bid/, { timeout: 20000 });
    await signInAtOp(page);
    await page.waitForTimeout(12000);
  }
} catch (e) {
  console.log("ERROR", e.message?.split("\\n")[0]);
}
console.log(hops.join("\\n"));
console.log("FINAL", short(page.url()), "title:", await page.title().catch(() => "?"));
console.log("HOP_COUNT", hops.length);
if (hops.some((h) => h.startsWith("REPEAT:"))) process.exit(2);
if (hops.length > maxHops) process.exit(3);
const verifyFix = process.env.SHOP_TRACE_VERIFY_FIX === "1";
if (verifyFix && scenario === "checkout" && !String(page.url()).includes("/checkout")) {
  console.error("FAIL: expected to land on /checkout after sign-in");
  process.exit(4);
}
await browser.close();
`;

process.exit(runPlaywrightTrace(playwrightBody));
