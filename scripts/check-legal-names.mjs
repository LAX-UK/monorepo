#!/usr/bin/env node
/**
 * Legal name lint: registered company names ("London Auction Xchange LTD", "London Art Exchange
 * Ltd") and the gallery's product name come from `@auction/branding` (`legalEntityFor`,
 * `legalEntitiesFor`, `LAX_PRODUCT_NAMES`). Typing them into product code drifts the moment an
 * entity or name changes. Runs from the repository root on every change.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

export const LEGAL_NAME_ROOTS = [
  "apps/account/src",
  "apps/api/src",
  "apps/art/src",
  "apps/auth/src",
  "apps/event/src",
  "apps/shop/src",
  "apps/shop-admin/src",
  "apps/shop-api/src",
  "apps/shop-identity/src",
  "apps/web/src",
  "apps/worker/src",
  "packages/email/src",
  "packages/identity-contracts/src",
  "packages/lax-ecosystem/src",
  "packages/marketing-ui/src",
  "packages/shop-portal/src",
  "packages/ui/src",
];

const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo"]);
const SOURCE_FILE = /\.(ts|tsx|mts|js|mjs)$/;
const TEST_FILE = /(\.test\.|\.spec\.|\.test-util\.|\/testing\/|\/__tests__\/|\/e2e\/)/;
/** Policies published verbatim from the business team; they name the company in their own words. */
const VERBATIM_POLICY_DIR = "packages/marketing-ui/src/legal/london-art-exchange/";
/**
 * Identity cannot depend on the products' packages, so its contract keeps its own copy of the
 * registered names. apps/web/src/lib/legal/sign-up-accepted-versions.test.ts checks every name in
 * it against legal-entity.ts, so the copy cannot drift.
 */
const IDENTITY_NAME_MIRROR = "packages/identity-contracts/src/legal-documents.ts";

/** Registered company names, in any casing of the suffix. */
export const COMPANY_NAME = /London Auction Xchange|London Art Exchange (Ltd|Limited)\b/i;
/** The gallery is written "lax.art". */
export const RETIRED_PRODUCT_NAME = /\bLAX Art\b(?! Exchange)/;
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

/** True for files the guard does not read (tests, verbatim policies, the identity mirror). */
export function isExempt(rel) {
  return TEST_FILE.test(rel) || rel.startsWith(VERBATIM_POLICY_DIR) || rel === IDENTITY_NAME_MIRROR;
}

/** Every non-comment line of `source` matching `pattern`, with its 1-based line number. */
export function findNameHits(source, pattern) {
  return source
    .split("\n")
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => !COMMENT_LINE.test(text) && pattern.test(text));
}

function listSources(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) listSources(path, out);
    else if (SOURCE_FILE.test(name)) out.push(path);
  }
  return out;
}

function findViolations(pattern) {
  const violations = [];
  for (const root of LEGAL_NAME_ROOTS) {
    for (const file of listSources(join(repoRoot, root))) {
      const rel = relative(repoRoot, file).split(sep).join("/");
      if (isExempt(rel)) continue;
      for (const hit of findNameHits(readFileSync(file, "utf8"), pattern)) {
        violations.push(`${rel}:${hit.line}: ${hit.text.trim()}`);
      }
    }
  }
  return violations;
}

function main() {
  const company = findViolations(COMPANY_NAME);
  const product = findViolations(RETIRED_PRODUCT_NAME);
  if (company.length > 0) {
    console.error(
      `Company names are not typed into product code; use legalEntityFor / legalEntitiesFor:\n  ${company.join("\n  ")}`,
    );
  }
  if (product.length > 0) {
    console.error(
      `Write the gallery as lax.art; use LAX_PRODUCT_NAMES:\n  ${product.join("\n  ")}`,
    );
  }
  if (company.length > 0 || product.length > 0) process.exit(1);
  console.log("legal names: ok");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
