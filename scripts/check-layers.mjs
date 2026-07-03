/**
 * Enforces package layering (DIP direction between workspace layers):
 *   1. packages/persistence, packages/domain, packages/db must not import from apps/**.
 *   2. packages/domain must not import @auction/persistence or @auction/db.
 *
 * Scans import/export-from specifiers in .ts/.tsx sources (tests and dist excluded).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @type {{ dir: string; forbiddenSpecifiers: RegExp[]; label: string }[]} */
const rules = [
  {
    dir: "packages/persistence",
    label: "packages/persistence must not import from apps/**",
    forbiddenSpecifiers: [/^@auction\/(api|web|worker|ws|auth-app|event)$/, /(^|\/)apps\//],
  },
  {
    dir: "packages/db",
    label: "packages/db must not import from apps/**",
    forbiddenSpecifiers: [/^@auction\/(api|web|worker|ws|auth-app|event)$/, /(^|\/)apps\//],
  },
  {
    dir: "packages/domain",
    label: "packages/domain must not import from apps/**",
    forbiddenSpecifiers: [/^@auction\/(api|web|worker|ws|auth-app|event)$/, /(^|\/)apps\//],
  },
  {
    dir: "packages/domain",
    label: "packages/domain must not import @auction/persistence or @auction/db",
    forbiddenSpecifiers: [/^@auction\/persistence(\/|$)/, /^@auction\/db(\/|$)/],
  },
];

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", "coverage"]);
const SOURCE_RE = /\.(ts|tsx)$/;
const TEST_RE = /\.(test|spec|integration\.test)\.(ts|tsx)$/;
// import ... from "x" | export ... from "x" | import("x") | require("x")
const SPECIFIER_RE =
  /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

/** @param {string} dir @returns {string[]} */
function listSources(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSources(full));
    } else if (SOURCE_RE.test(entry) && !TEST_RE.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Relative import escaping the package into apps/ (e.g. ../../apps/api/...). */
function relativeEscapesIntoApps(fromFile, specifier) {
  if (!specifier.startsWith(".")) return false;
  const resolved = resolve(dirname(fromFile), specifier);
  return relative(root, resolved).replace(/\\/g, "/").startsWith("apps/");
}

/** @type {string[]} */
const violations = [];

for (const rule of rules) {
  const base = join(root, rule.dir);
  let files;
  try {
    files = listSources(base);
  } catch {
    continue; // layer dir absent — nothing to check
  }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(SPECIFIER_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) continue;
      const forbidden =
        rule.forbiddenSpecifiers.some((re) => re.test(specifier)) ||
        relativeEscapesIntoApps(file, specifier);
      if (forbidden) {
        violations.push(`${relative(root, file)} imports "${specifier}" — violates: ${rule.label}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Layering violations detected:\n");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  console.error("\nFix the import direction (see scripts/check-layers.mjs for the rules).");
  process.exit(1);
}

console.log("check-layers: ok (no layering violations)");
