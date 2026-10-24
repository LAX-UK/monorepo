#!/usr/bin/env node
/**
 * Staff list template guardrail: every list page in Bid admin and LAX Admin is built on the staff
 * kit's `ListPage`, so the two tools keep one layout (header, attention, metrics, one table
 * surface). A list page counts as migrated when the page, or a component it imports from the
 * app, imports `ListPage` from `@auction/staff-ui`.
 *
 * Pages not migrated yet are listed in `staff-list-template-allowlist.json`. The check prints a
 * report and fails only on drift:
 * - a list page that is neither on `ListPage` nor in the allowlist (a new page built the old way);
 * - an allowlisted page that is now on `ListPage` (remove it from the list, so it stays migrated).
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

async function usesListPage(app, file, depth = 0, seen = new Set()) {
  if (seen.has(file)) return false;
  seen.add(file);
  const text = await readFile(file, "utf8");
  if (LIST_PAGE_IMPORT.test(text)) return true;
  if (depth >= MAX_DEPTH) return false;
  for (const match of text.matchAll(LOCAL_IMPORT)) {
    const specifier = match[1];
    // Server data modules never render the page; skip them to keep the walk short.
    if (/\/(?:server|data\/http|actions)\//.test(specifier)) continue;
    const resolved = resolveImport(app, file, specifier);
    if (resolved && (await usesListPage(app, resolved, depth + 1, seen))) return true;
  }
  return false;
}

const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
const pending = new Set(config.pending.map((entry) => entry.page));
const exempt = new Set(config.exempt.map((entry) => entry.page));
const extraLists = new Set(config.extraListRoutes ?? []);

const report = { migrated: [], pending: [], exempt: [], drift: [], stale: [] };

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
    } else if (pending.has(key)) {
      report.pending.push(key);
    } else {
      report.drift.push(key);
    }
  }
}

const known = new Set([...report.migrated, ...report.pending, ...report.exempt]);
const missing = [...pending, ...exempt].filter((key) => !known.has(key));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ...report, missing }, null, 2));
} else {
  console.log(
    `staff list template: ${report.migrated.length} on ListPage, ${report.pending.length} still to migrate, ${report.exempt.length} not list pages`,
  );
  for (const key of report.migrated) console.log(`  ✓ ${key}`);
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

if (failures.length > 0) {
  console.error("\nerror: staff list template drift:\n");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
