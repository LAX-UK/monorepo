#!/usr/bin/env node
/**
 * Staff route composition guardrail — routes delegate orchestration to load-*-page modules.
 * Existing violations are allowlisted with dated removal conditions; new routes must use a loader.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ADMIN_APP = path.join(ROOT, "apps/web/src/app/admin");

/** Max lines in a route page before requiring a loader (list/hub/detail/form). */
const ROUTE_PAGE_LINE_CAP = 120;

/**
 * Grandfathered routes — owner: staff-redesign program.
 * Removal condition must name the loader todo or module that migrates the route.
 */
const ALLOWLIST = new Map([]);

const LOADER_PATTERN =
  /loadAdmin[A-Za-z]+(?:Page|Detail)|load-[a-z-]+-(?:list|hub|detail|page)|loadSaleroom[A-Za-z]+Page/;

const HTTP_IMPORT = /from\s+["']@\/lib\/data\/http\//;

const ORCHESTRATION_PATTERN =
  /Promise\.all(?:Settled)?\s*\(|build[A-Z][A-Za-z]+PageModel\s*\(|build[A-Z][A-Za-z]+ListPageModel\s*\(/;

/** Inline display-policy construction in routes — belongs in VMs/presenters. */
const DISPLAY_POLICY_PATTERN =
  /(?:const|let)\s+(?:columns|statusLabels|displayColumns|rowActions)\s*(?::[^=]+)?=\s*\[/;

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.name === "page.tsx") out.push(full);
  }
  return out;
}

function routeKind(rel) {
  if (rel.includes("/(detail)/") || rel.includes("/[id]/") || rel.includes("/[slug]/")) {
    if (rel.includes("/edit/") || rel.endsWith("/edit/page.tsx")) return "form";
    if (rel.includes("/new/") || rel.endsWith("/new/page.tsx")) return "form";
    if (rel.includes("/setup/") || rel.includes("/decision/")) return "form";
    if (rel.includes("/check-in/")) return "form";
    return "detail";
  }
  if (
    rel.includes("/new/") ||
    rel.endsWith("/new/page.tsx") ||
    rel.includes("/edit/") ||
    rel.endsWith("/edit/page.tsx") ||
    rel.includes("/setup/") ||
    rel.includes("/decision/")
  ) {
    return "form";
  }
  if (rel.includes("/impersonation/")) return "utility";
  if (rel.includes("/saleroom/[saleId]/")) return "utility";
  return "list";
}

function stripGenerateMetadata(source) {
  return source.replace(/export\s+async\s+function\s+generateMetadata[\s\S]*?^}/m, "");
}

function lineCount(source) {
  return source.split("\n").length;
}

function isAllowlistMigrationComplete(body, usesLoader, lines) {
  return (
    usesLoader &&
    !HTTP_IMPORT.test(body) &&
    !ORCHESTRATION_PATTERN.test(body) &&
    !DISPLAY_POLICY_PATTERN.test(body) &&
    lines <= ROUTE_PAGE_LINE_CAP
  );
}

const pages = await walk(ADMIN_APP);
const violations = [];

for (const file of pages) {
  const rel = path.relative(ADMIN_APP, file);
  const kind = routeKind(rel);
  if (kind === "utility") continue;

  const text = await readFile(file, "utf8");
  const body = stripGenerateMetadata(text);
  const allowReason = ALLOWLIST.get(rel);
  const usesLoader = LOADER_PATTERN.test(text);
  const importsHttp = HTTP_IMPORT.test(body);
  const orchestrates = ORCHESTRATION_PATTERN.test(body);
  const buildsDisplayPolicy = DISPLAY_POLICY_PATTERN.test(body);
  const lines = lineCount(text);

  if (allowReason) {
    if (isAllowlistMigrationComplete(body, usesLoader, lines)) {
      violations.push(
        `${rel}: allowlist entry stale — loader migration complete; remove from ALLOWLIST (${allowReason})`,
      );
    }
    continue;
  }

  if (importsHttp && !usesLoader) {
    violations.push(
      `${rel}: route imports @/lib/data/http/* without a load-*-page module — move orchestration to lib/admin`,
    );
  }

  if (orchestrates && !usesLoader) {
    violations.push(
      `${rel}: inline orchestration (Promise.all / build*PageModel) — extract to lib/admin/load-*-page.ts`,
    );
  }

  if (buildsDisplayPolicy) {
    violations.push(
      `${rel}: inline display policy (columns/statusLabels) — move to lib/admin/**/*.vm.ts or presenter registry`,
    );
  }

  if (lines > ROUTE_PAGE_LINE_CAP && !usesLoader) {
    violations.push(
      `${rel}: page.tsx is ${lines} lines (cap ${ROUTE_PAGE_LINE_CAP}) without a loader — extract orchestration`,
    );
  }
}

if (violations.length > 0) {
  console.error("error: staff route composition violations:\n");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("staff route composition: ok");
