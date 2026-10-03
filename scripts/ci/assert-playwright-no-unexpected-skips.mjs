#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), "apps/shop/playwright-report/results.json");
if (!fs.existsSync(reportPath)) {
  console.error(`Missing Playwright JSON report at ${reportPath}`);
  process.exit(1);
}

const allowedReasonPatterns = [
  /^Set SHOP_E2E_STRIPE_CHECKOUT=1/,
  /^buyer journey on desktop only$/,
  /^authenticated journey on desktop only$/,
  /^desktop basket controls only$/,
  /^no-JS contract once on desktop$/,
  /^Set SHOP_E2E_MAGIC_LINK=1/,
  /^harbor-print has a single sellable edition in this environment$/,
];

/** @typedef {{ status?: string, title?: string, results?: Suite[] }} Suite */

/** @param {Suite[]} suites @returns {{ unexpected: { title: string, reason: string }[] }} */
function collectSkips(suites) {
  /** @type {{ title: string, reason: string }[]} */
  const unexpected = [];

  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          if (result.status !== "skipped") continue;
          const reason = (result.error?.message ?? spec.title ?? test.title ?? "unknown").trim();
          const allowed = allowedReasonPatterns.some((pattern) => pattern.test(reason));
          if (!allowed) {
            unexpected.push({
              title: `${suite.title ?? ""} › ${spec.title ?? test.title ?? "test"}`,
              reason,
            });
          }
        }
      }
    }
    if (suite.suites?.length) {
      unexpected.push(...collectSkips(suite.suites).unexpected);
    }
  }

  return { unexpected };
}

const raw = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const { unexpected } = collectSkips(raw.suites ?? []);

if (unexpected.length > 0) {
  console.error("Unexpected Playwright skips:");
  for (const entry of unexpected) {
    console.error(`- ${entry.title}: ${entry.reason}`);
  }
  process.exit(1);
}

console.log("Playwright skip audit passed (no unexpected skips).");
