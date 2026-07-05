/**
 * Web architecture guardrails (Phase F5):
 *   1. Component size cap for .tsx under apps/web/src/components and features/
 *      — warn >400 lines, fail >550 (tests excluded).
 *   2. Fetch boundary — global fetch() only in *.client.ts, *.server.ts, lib/data/http/**
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const webSrc = join(root, "apps/web/src");

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", "coverage"]);
const COMPONENT_DIRS = ["components", "features"].map((d) => join(webSrc, d));

const WARN_LINES = 400;
const FAIL_LINES = 550;
const SPECIFIER_RE =
  /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

/** @param {string} dir @returns {string[]} */
function listTsx(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsx(full));
    } else if (entry.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** @param {string} dir @returns {string[]} */
function listWebSources(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listWebSources(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** @param {string} rel POSIX path relative to apps/web/src */
function isAllowedFetchSite(rel) {
  if (rel.startsWith("lib/data/http/")) return true;
  if (rel.endsWith(".client.ts") || rel.endsWith(".client.tsx")) return true;
  if (rel.endsWith(".server.ts") || rel.endsWith(".server.tsx")) return true;
  if (/\.(test|spec)\.(ts|tsx)$/.test(rel)) return true;
  return false;
}

/** @param {string} text */
function hasGlobalFetchCall(text) {
  const lines = text.split("\n");
  for (const line of lines) {
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
    if (/\basync\s+fetch\s*\(/.test(line)) continue;
    if (/^\s*fetch\s*\([^)]*\)\s*:/.test(line)) continue;
    if (/^\s*fetch\s*\([^)]*\)\s*=>/.test(line)) continue;
    if (/(?:^|[^.\w])fetch\s*\(/.test(line)) return true;
  }
  return false;
}

/** @type {string[]} */
const sizeWarnings = [];
/** @type {string[]} */
const sizeFailures = [];
/** @type {string[]} */
const fetchViolations = [];

let failed = false;

for (const dir of COMPONENT_DIRS) {
  let files;
  try {
    files = listTsx(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    const rel = relative(webSrc, file).replace(/\\/g, "/");
    const lineCount = readFileSync(file, "utf8").split("\n").length;
    if (lineCount > FAIL_LINES) {
      sizeFailures.push(`${rel}: ${lineCount} lines (cap ${FAIL_LINES})`);
    } else if (lineCount > WARN_LINES) {
      sizeWarnings.push(`${rel}: ${lineCount} lines (warn above ${WARN_LINES})`);
    }
  }
}

for (const file of listWebSources(webSrc)) {
  const rel = relative(webSrc, file).replace(/\\/g, "/");
  if (isAllowedFetchSite(rel)) continue;
  const text = readFileSync(file, "utf8");
  if (hasGlobalFetchCall(text)) {
    fetchViolations.push(
      `${rel}: global fetch() — use *.client.ts, *.server.ts, or lib/data/http/**`,
    );
  }
}

/** @type {string[]} */
const libComponentViolations = [];

for (const file of listWebSources(join(webSrc, "lib/ui/bid-error"))) {
  const rel = relative(webSrc, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier?.includes("/components/") || specifier?.startsWith("@/components/")) {
      libComponentViolations.push(
        `${rel}: imports "${specifier}" — lib/ui/bid-error must not depend on components/**`,
      );
    }
  }
}

if (libComponentViolations.length > 0) {
  failed = true;
  console.error("lib/ui/bid-error component import violations:\n");
  for (const v of libComponentViolations) {
    console.error(`  ${v}`);
  }
  console.error("\nKeep bid-error matchers free of @/components/** imports.");
}

if (sizeWarnings.length > 0) {
  console.warn("Component size warnings:\n");
  for (const w of sizeWarnings) {
    console.warn(`  ${w}`);
  }
  console.warn("");
}

if (sizeFailures.length > 0) {
  failed = true;
  console.error("Component size failures:\n");
  for (const v of sizeFailures) {
    console.error(`  ${v}`);
  }
  console.error("");
}

if (fetchViolations.length > 0) {
  failed = true;
  console.error("Fetch boundary violations:\n");
  for (const v of fetchViolations) {
    console.error(`  ${v}`);
  }
  console.error("\nRoute HTTP I/O through lib/data/http/** or *.client.ts / *.server.ts modules.");
}

if (failed) {
  process.exit(1);
}

console.log(
  `check-web-guardrails: ok (${sizeWarnings.length} size warning${sizeWarnings.length === 1 ? "" : "s"})`,
);
