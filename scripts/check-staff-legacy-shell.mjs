#!/usr/bin/env node
/**
 * Staff legacy shell guardrails:
 * - Rejects deprecated AdminListKpiStrip / AdminListFilterSheet imports
 * - Rejects inline list-board card surfaces outside CatalogBoardCard
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");

const DEPRECATED_PATTERNS = [
  { pattern: /AdminListKpiStrip/, message: "deprecated AdminListKpiStrip — use AdminTrendKpiBand" },
  {
    pattern: /AdminListFilterSheet/,
    message: "deprecated AdminListFilterSheet — use catalog filter controls / SplitFilterSheet",
  },
];

const BOARD_CARD_CLASS =
  "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]";

const BOARD_CARD_ALLOWLIST = new Set([
  "components/admin/catalog/catalog-board-card.tsx",
  "components/admin/catalog/catalog-board-card.test.tsx",
  "components/admin/payouts-board/settlement-readiness-band.tsx",
]);

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const files = await walk(WEB_SRC);
const violations = [];

for (const file of files) {
  const rel = path.relative(WEB_SRC, file);
  const text = await readFile(file, "utf8");

  for (const { pattern, message } of DEPRECATED_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`${rel}: ${message}`);
    }
  }

  if (BOARD_CARD_ALLOWLIST.has(rel)) continue;
  const isListBoard =
    /\/[^/]+-board\/(index|board)\.tsx$/.test(rel) ||
    /\/admin-(clients|staff)-board\.tsx$/.test(rel);
  if (!isListBoard) continue;
  if (text.includes(BOARD_CARD_CLASS) && !text.includes("catalogBoardCardClassName")) {
    violations.push(`${rel}: inline board card surface — use CatalogBoardCard`);
  }
}

if (violations.length > 0) {
  console.error("error: staff legacy shell violations:\n");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("staff legacy shell guardrails: ok");
