#!/usr/bin/env node
/**
 * Brand name lint: the product is written "LAX Bid" in copy. "LAX.BID" belongs only to the
 * wordmark lockup (an image or SVG), never to a sentence, a title or a heading. The domain stays
 * lower case (lax.bid) and is not matched.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Folders whose files can hold copy, relative to the repository root. */
export const BRAND_NAME_ROOTS = ["apps", "packages", "docs"];

const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", "coverage", "public"]);
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|html|mdx?)$/;
const TEST_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/;
const WRONG_NAME = /LAX\.BID/;

/** Every line of `source` that spells the wrong name, with its 1-based line number. */
export function findWrongBrandName(source) {
  return source
    .split("\n")
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => WRONG_NAME.test(text));
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

function main() {
  const violations = [];
  for (const root of BRAND_NAME_ROOTS) {
    for (const file of listFiles(join(repoRoot, root))) {
      for (const hit of findWrongBrandName(readFileSync(file, "utf8"))) {
        violations.push(`${relative(repoRoot, file).split(sep).join("/")}:${hit.line}`);
      }
    }
  }
  if (violations.length > 0) {
    console.error(`Write "LAX Bid", not "LAX.BID", in copy:\n  ${violations.join("\n  ")}`);
    process.exit(1);
  }
  console.log("brand name: ok");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
