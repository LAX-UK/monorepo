#!/usr/bin/env node
/**
 * Seller commission lint: one function, `sellerProceeds` in @auction/domain, works out what a
 * seller receives. Nothing else multiplies a hammer by a commission rate, and the two paths that
 * raise a buyer's payment get the seller's side from the seller-terms policy, never from the old
 * platform fee policy.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Where the one calculator lives. */
export const CALCULATOR_FILE = "packages/domain/src/seller-proceeds.ts";

/** The two processes that raise a buyer's payment: they must not read the old fee policy. */
export const PAYMENT_RAISING_FILES = [
  "apps/api/src/services/payment/create-pending-for-winner.pipeline.ts",
  "packages/finance-runtime/src/lot-invoice-initiation.service.ts",
];

const ROOTS = ["apps", "packages"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", "coverage"]);
const SOURCE_FILE = /\.[cm]?tsx?$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/;

const RATE = String.raw`(?:\w+\.)*\w*(?:commission|bps)\w*`;
const HAMMER = String.raw`(?:\w+\.)*\w*hammer\w*`;
/** `hammer * commission` and `commission * hammer`, in either order, case-insensitively. */
const HAMMER_TIMES_RATE = new RegExp(
  String.raw`\b${HAMMER}\s*\*\s*${RATE}|\b${RATE}\s*\*\s*${HAMMER}`,
  "i",
);
const MONEY = String.raw`(?:\w+\.)*\w*(?:pence|amount|hammer|price|total|minor)\w*`;
/**
 * The old 5% fallback (`Math.round(amountPence * 0.05)`): a money figure times a flat 5%. The
 * legacy platform fee is in basis points in its own policy, so nothing else needs this shape.
 */
const FLAT_FIVE_PERCENT = new RegExp(
  String.raw`\b${MONEY}\s*\*\s*0?\.05\b|(?<![\w.])0?\.05\s*\*\s*${MONEY}`,
  "i",
);
const OLD_FEE_POLICY = /PlatformFeePolicy|platform-fee\.policy/;

function linesMatching(source, pattern) {
  return source
    .split("\n")
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => !text.trim().startsWith("//") && !text.trim().startsWith("*"))
    .filter(({ text }) => pattern.test(text));
}

/** Every line that multiplies a hammer by a commission rate. */
export function findHammerTimesRate(source) {
  return linesMatching(source, HAMMER_TIMES_RATE);
}

/** Every line that takes a flat 5% of a money figure: the old fallback commission. */
export function findFlatFivePercent(source) {
  return linesMatching(source, FLAT_FIVE_PERCENT);
}

/** Every line that names the old platform fee policy. */
export function findOldFeePolicy(source) {
  return linesMatching(source, OLD_FEE_POLICY);
}

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) listFiles(full, out);
    else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) out.push(full);
  }
  return out;
}

const rel = (file) => relative(repoRoot, file).split(sep).join("/");

function main() {
  const violations = [];
  for (const root of ROOTS) {
    for (const file of listFiles(join(repoRoot, root))) {
      const path = rel(file);
      if (path === CALCULATOR_FILE) continue;
      const source = readFileSync(file, "utf8");
      for (const hit of findHammerTimesRate(source)) {
        violations.push(
          `${path}:${hit.line}  multiplies a hammer by a commission rate; use sellerProceeds`,
        );
      }
      for (const hit of findFlatFivePercent(source)) {
        violations.push(
          `${path}:${hit.line}  takes a flat 5% of a money figure; use sellerProceeds`,
        );
      }
    }
  }
  for (const path of PAYMENT_RAISING_FILES) {
    for (const hit of findOldFeePolicy(readFileSync(join(repoRoot, path), "utf8"))) {
      violations.push(
        `${path}:${hit.line}  reads the old platform fee policy; use the seller-terms policy`,
      );
    }
  }
  if (violations.length > 0) {
    console.error(`Seller commission has one calculator:\n  ${violations.join("\n  ")}`);
    process.exit(1);
  }
  console.log("seller commission: ok");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
