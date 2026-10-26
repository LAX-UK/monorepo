#!/usr/bin/env node
/**
 * Staff legacy shell guardrails:
 * - Rejects deprecated AdminListKpiStrip / AdminListFilterSheet imports
 * - Rejects inline list-board card surfaces outside CatalogBoardCard
 * - Rejects `@auction/ui/components/*` imports in Bid admin (app/admin and components/admin):
 *   admin screens are built on `@auction/staff-ui`. Files still moving over are listed in
 *   `staff-legacy-ui-allowlist.json` with the reason; an allowlisted file that no longer imports
 *   the old components (or no longer exists) fails too, so the list only shrinks.
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");
const ADMIN_DIRS = ["app/admin", "components/admin"];
const LEGACY_UI_IMPORT = /["']@auction\/ui\/components\/[^"']+["']/;
const ALLOWLIST_PATH = path.join(import.meta.dirname, "staff-legacy-ui-allowlist.json");

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

const allowlist = JSON.parse(await readFile(ALLOWLIST_PATH, "utf8"));
const pending = new Map((allowlist.pending ?? []).map((entry) => [entry.file, entry.reason]));
for (const [file, reason] of pending) {
  if (!reason || !String(reason).trim()) {
    violations.push(`${file}: allowlisted in staff-legacy-ui-allowlist.json without a reason`);
  }
  if (!existsSync(path.join(WEB_SRC, file))) {
    violations.push(`${file}: no longer exists — remove it from staff-legacy-ui-allowlist.json`);
  }
}

for (const file of files) {
  const rel = path.relative(WEB_SRC, file);
  const text = await readFile(file, "utf8");

  for (const { pattern, message } of DEPRECATED_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`${rel}: ${message}`);
    }
  }

  if (ADMIN_DIRS.some((dir) => rel.startsWith(`${dir}/`))) {
    const legacy = LEGACY_UI_IMPORT.test(text);
    if (legacy && !pending.has(rel)) {
      violations.push(
        `${rel}: imports @auction/ui/components — build admin screens with @auction/staff-ui`,
      );
    } else if (!legacy && pending.has(rel)) {
      violations.push(
        `${rel}: no longer imports @auction/ui/components — remove it from staff-legacy-ui-allowlist.json`,
      );
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

console.log(
  pending.size > 0
    ? `staff legacy shell guardrails: ok (${pending.size} admin files still on @auction/ui/components, see staff-legacy-ui-allowlist.json)`
    : "staff legacy shell guardrails: ok",
);
