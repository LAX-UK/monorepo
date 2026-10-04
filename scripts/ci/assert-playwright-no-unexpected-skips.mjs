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
  /^Prints rail has no overflow in this viewport$/,
  /^home catalogue cards once on desktop$/,
  /^desktop rail affordance only$/,
];

function normalizeSkipReason(reason) {
  if (reason === "shows forward rail affordance when a home row overflows") {
    return "Prints rail has no overflow in this viewport";
  }
  return reason;
}

function resolveSkipReason(result, spec, test) {
  const message = (result.error?.message ?? "").trim();
  if (message) {
    const explicit = message.match(/(?:Test )?skipped:\s*(.+)/i);
    if (explicit?.[1]) {
      return normalizeSkipReason(explicit[1].trim());
    }
    return normalizeSkipReason(message);
  }
  const title = (spec.title ?? test.title ?? "unknown").trim();
  return normalizeSkipReason(title);
}

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
          const reason = resolveSkipReason(result, spec, test);
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
