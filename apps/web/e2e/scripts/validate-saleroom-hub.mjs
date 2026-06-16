/**
 * One-off validation script for saleroom hub + clerk console (bypasses test runner).
 * Usage: node e2e/scripts/validate-saleroom-hub.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = process.env.PLAYWRIGHT_STAFF_EMAIL ?? "admin@lax.bid";
const PASSWORD = process.env.PLAYWRIGHT_STAFF_PASSWORD ?? "Password123!";
const HYBRID_A = "e1000003-0000-4000-8000-000000000003";

async function staffLogin(page) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[name="email"]').fill(EMAIL);
  const continueBtn = page.getByRole("button", { name: /^continue$/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await page.locator('input[name="password"]').waitFor({ timeout: 10_000 });
  }
  const password = page.locator('input[name="password"]');
  await password.click();
  await password.fill(PASSWORD);
  await page
    .locator("form")
    .first()
    .evaluate((form) => form.requestSubmit());
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30_000 });
}

const checks = [];

function pass(name) {
  checks.push({ name, ok: true });
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  checks.push({ name, ok: false, err: String(err) });
  console.error(`✗ ${name}: ${err}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await staffLogin(page);
  pass("staff login");

  await page.goto(`${BASE}/admin/saleroom`);
  await page.getByRole("heading", { name: /live rooms/i }).waitFor({ timeout: 30_000 });
  pass("hub live rooms heading");

  const hybridLink = page.getByRole("link", { name: /hybrid day sale — room a/i });
  await hybridLink.waitFor({ timeout: 10_000 });
  pass("room A card visible");

  await page
    .getByText(/lot \d+ of \d+|between lots|of \d+ complete/i)
    .first()
    .waitFor({
      timeout: 10_000,
    });
  pass("progress label on hub card");

  const progressbar = page.getByRole("progressbar").first();
  await progressbar.waitFor({ timeout: 10_000 });
  const max = Number(await progressbar.getAttribute("aria-valuemax"));
  if (max > 0) pass(`progress bar max=${max}`);
  else fail("progress bar max", `expected > 0, got ${max}`);

  await page
    .getByRole("link", { name: /open console/i })
    .first()
    .click();
  await page.waitForURL(/\/admin\/saleroom\/[0-9a-f-]+/i, { timeout: 15_000 });
  pass("open console navigates to clerk");

  await page.goto(`${BASE}/admin/saleroom/${HYBRID_A}`);
  await page
    .getByText(/lot \d+ of \d+|between lots|of \d+ complete/i)
    .first()
    .waitFor({
      timeout: 15_000,
    });
  pass("clerk session bar progress label");

  const body = await page.textContent("body");
  if (/meridian drift|on block|live/i.test(body ?? "")) {
    pass("room A clerk shows live/on-block context");
  } else {
    fail("room A clerk context", "expected Meridian Drift or on-block/live text");
  }
} catch (err) {
  fail("unexpected", err);
}

await browser.close();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) {
  process.exit(1);
}
