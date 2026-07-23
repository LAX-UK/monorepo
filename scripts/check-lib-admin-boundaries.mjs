#!/usr/bin/env node
/**
 * Prevents new lib → components dependency inversions under apps/web/src/lib/admin.
 * Existing exceptions are allowlisted until migrated in follow-up slices.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIB_ADMIN = path.join(ROOT, "apps/web/src/lib/admin");
const SKIP_SUFFIX = [".test.ts", ".test.tsx"];

/** Files allowed to import from @/components until contracts are lifted. */
const ALLOWLIST = new Set([
  "build-trend-kpi-tile.ts",
  "build-staff-header-attention-items.ts",
  "saleroom-hub-page-data.ts",
  "legal-entity-list-presenter.ts",
  "catalog-nav-action-adapter.ts",
  "build-sale-lifecycle-mobile-actions.ts",
  "build-lot-mobile-actions.ts",
  "stripe-connect-staff-presenter.ts",
  "detail-board/map-kpi-tiles.ts",
]);

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function isSkipped(file) {
  return SKIP_SUFFIX.some((s) => file.endsWith(s));
}

const files = (await walk(LIB_ADMIN)).filter((f) => !isSkipped(f));
const violations = [];

for (const file of files) {
  const rel = path.relative(LIB_ADMIN, file);
  const base = path.basename(file);
  if (ALLOWLIST.has(rel) || ALLOWLIST.has(base)) continue;

  const text = await readFile(file, "utf8");
  const importRe = /from\s+["']@\/components\/[^"']+["']/g;
  let match = importRe.exec(text);
  while (match !== null) {
    violations.push(`${rel}: ${match[0]}`);
    match = importRe.exec(text);
  }
}

if (violations.length > 0) {
  console.error("error: lib/admin → components boundary violations:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nMove shared contracts to apps/web/src/lib/admin/** or add a temporary allowlist entry in scripts/check-lib-admin-boundaries.mjs",
  );
  process.exit(1);
}

console.log("lib/admin boundaries: ok");
