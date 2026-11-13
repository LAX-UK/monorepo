#!/usr/bin/env node
/**
 * Staff list template guardrail: every list page in Bid admin and LAX Admin is built on the staff
 * kit's `ListPage`, so the two tools keep one layout (header, attention, metrics, one table
 * surface). A list page counts as migrated when the page, or a component it imports from the
 * app, imports `ListPage` from `@auction/staff-ui`.
 *
 * Every list on `ListPage` also declares what a row opens (staff design standard, TBL-8 and
 * PRD-7: "Side panel or full page"): `rowHref` on its table, so a row opens the record's page, or
 * `useQueuePanel`, for a work queue that keeps a panel. Found the same way, in the page or a
 * component it imports.
 *
 * Pages not migrated yet are listed in `staff-list-template-allowlist.json`. The check prints a
 * report and fails only on drift:
 * - a list page that is neither on `ListPage` nor in the allowlist (a new page built the old way);
 * - an allowlisted page that is now on `ListPage` (remove it from the list, so it stays migrated);
 * - a list on `ListPage` that declares neither `rowHref` nor `useQueuePanel` and is not in
 *   `rowOpenPending` or `rowOpenNone` (a new list that leaves a row's click undecided);
 * - a `rowOpenPending` page that now declares one (remove it from the list).
 *
 * Usage: node scripts/check-staff-list-template.mjs [--json]
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(import.meta.dirname, "staff-list-template-allowlist.json");

const APPS = [
  { id: "bid-admin", src: path.join(ROOT, "apps/web/src"), routes: "app/admin" },
  { id: "lax-admin", src: path.join(ROOT, "apps/shop-admin/src"), routes: "app/(staff)" },
];

/** Segments that make a page a form or a tool rather than a list. */
const NON_LIST_SEGMENTS = new Set(["new", "edit", "import", "setup", "decision", "check-in"]);

const LIST_PAGE_IMPORT =
  /import\s*(?:type\s*)?\{[^}]*\bListPage\b[^}]*\}\s*from\s*["']@auction\/staff-ui["']/;
/** A table given `rowHref` (`rowHref={…}` or `rowHref: …`), or a work queue's panel hook. */
const ROW_OPEN_DECLARATION = /\browHref\s*[=:]|\buseQueuePanel\s*\(/;
const LOCAL_IMPORT = /from\s+["']((?:@\/|\.{1,2}\/)[^"']+)["']/g;
const MAX_DEPTH = 3;

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

const isDynamic = (segment) => segment.startsWith("[") && segment.endsWith("]");

/** A list page: no dynamic segment in its route, and not a form or tool. */
function isListRoute(key, relFromRoutes, extraLists) {
  if (extraLists.has(key)) return true;
  const segments = relFromRoutes.split("/").slice(0, -1);
  if (segments.some(isDynamic)) return false;
  return !segments.some((segment) => NON_LIST_SEGMENTS.has(segment));
}

function resolveImport(app, fromFile, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(app.src, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ]) {
    if (candidate.endsWith(".tsx") || candidate.endsWith(".ts")) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** True when the page, or a component it imports (to MAX_DEPTH), matches `pattern`. */
async function pageContains(app, pattern, file, depth = 0, seen = new Set()) {
  if (seen.has(file)) return false;
  seen.add(file);
  const text = await readFile(file, "utf8");
  if (pattern.test(text)) return true;
  if (depth >= MAX_DEPTH) return false;
  for (const match of text.matchAll(LOCAL_IMPORT)) {
    const specifier = match[1];
    // Server data modules never render the page; skip them to keep the walk short.
    if (/\/(?:server|data\/http|actions)\//.test(specifier)) continue;
    const resolved = resolveImport(app, file, specifier);
    if (resolved && (await pageContains(app, pattern, resolved, depth + 1, seen))) return true;
  }
  return false;
}

const usesListPage = (app, file) => pageContains(app, LIST_PAGE_IMPORT, file);
const declaresRowOpen = (app, file) => pageContains(app, ROW_OPEN_DECLARATION, file);

const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
const pending = new Set(config.pending.map((entry) => entry.page));
const exempt = new Set(config.exempt.map((entry) => entry.page));
const extraLists = new Set(config.extraListRoutes ?? []);
const rowOpenPending = new Set((config.rowOpenPending ?? []).map((entry) => entry.page));
const rowOpenNone = new Set((config.rowOpenNone ?? []).map((entry) => entry.page));

const report = {
  migrated: [],
  pending: [],
  exempt: [],
  drift: [],
  stale: [],
  rowOpen: { declared: [], pending: [], none: [], drift: [], stale: [] },
};

for (const app of APPS) {
  const routesDir = path.join(app.src, app.routes);
  for (const file of (await walk(routesDir)).sort()) {
    const relFromRoutes = path.relative(routesDir, file);
    const key = `${app.id}:${relFromRoutes}`;
    if (!isListRoute(key, relFromRoutes, extraLists)) continue;
    if (exempt.has(key)) {
      report.exempt.push(key);
      continue;
    }
    const onTemplate = await usesListPage(app, file);
    if (onTemplate) {
      report.migrated.push(key);
      if (pending.has(key)) report.stale.push(key);
      const declared = await declaresRowOpen(app, file);
      if (declared) {
        report.rowOpen.declared.push(key);
        if (rowOpenPending.has(key)) report.rowOpen.stale.push(key);
      } else if (rowOpenPending.has(key)) {
        report.rowOpen.pending.push(key);
      } else if (rowOpenNone.has(key)) {
        report.rowOpen.none.push(key);
      } else {
        report.rowOpen.drift.push(key);
      }
    } else if (pending.has(key)) {
      report.pending.push(key);
    } else {
      report.drift.push(key);
    }
  }
}

const known = new Set([...report.migrated, ...report.pending, ...report.exempt]);
const missing = [...pending, ...exempt].filter((key) => !known.has(key));
const migrated = new Set(report.migrated);
const rowOpenMissing = [...rowOpenPending, ...rowOpenNone].filter((key) => !migrated.has(key));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ...report, missing, rowOpenMissing }, null, 2));
} else {
  console.log(
    `staff list template: ${report.migrated.length} on ListPage, ${report.pending.length} still to migrate, ${report.exempt.length} not list pages`,
  );
  for (const key of report.migrated) console.log(`  ✓ ${key}`);
  console.log(
    `row open: ${report.rowOpen.declared.length} declare rowHref or a queue panel, ${report.rowOpen.pending.length} still to adopt, ${report.rowOpen.none.length} open no record`,
  );
}

const failures = [];
for (const key of report.drift) {
  failures.push(
    `${key}: list page not built on ListPage from @auction/staff-ui (see packages/staff-ui/README.md)`,
  );
}
for (const key of report.stale) {
  failures.push(
    `${key}: now on ListPage; remove it from scripts/staff-list-template-allowlist.json`,
  );
}
for (const key of missing) {
  failures.push(`${key}: listed in scripts/staff-list-template-allowlist.json but no such page`);
}
for (const key of report.rowOpen.drift) {
  failures.push(
    `${key}: list does not say what a row opens; give its table rowHref (the record's page) or use useQueuePanel (a work queue), see docs/design/staff-design-standard.md TBL-8`,
  );
}
for (const key of report.rowOpen.stale) {
  failures.push(
    `${key}: now declares rowHref or useQueuePanel; remove it from rowOpenPending in scripts/staff-list-template-allowlist.json`,
  );
}
for (const key of rowOpenMissing) {
  failures.push(
    `${key}: in rowOpenPending or rowOpenNone in scripts/staff-list-template-allowlist.json but not a list on ListPage`,
  );
}

if (failures.length > 0) {
  console.error("\nerror: staff list template drift:\n");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
