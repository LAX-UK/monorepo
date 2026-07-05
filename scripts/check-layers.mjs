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

// ─── Architecture invariants (Phase E6) ─────────────────────────────────────

const DRIZZLE_NEW_RE = /new\s+Drizzle\w+/;
const PUBLISH_TX_RE = /publish\s*\(\s*tx\b/;

/** @param {string} rel POSIX path relative to repo root */
function isTestSource(rel) {
  return /\.(test|spec|integration\.test)\.(ts|tsx)$/.test(rel);
}

/** @param {string} rel */
function isAllowedDrizzleSite(rel) {
  if (rel.startsWith("packages/persistence/")) return true;
  if (/^apps\/[^/]+\/src\/container\//.test(rel)) return true;
  if (/^apps\/[^/]+\/src\/container\.ts$/.test(rel)) return true;
  if (rel === "apps/api/src/services/payout/payout-helpers.ts") return true;
  if (rel === "apps/api/src/services/lot-transition-guards.ts") return true;
  if (isTestSource(rel)) return true;
  if (rel.startsWith("apps/api/src/repositories/")) return true;
  if (rel.startsWith("apps/api/src/exports/")) return true;
  if (/\/scripts\//.test(rel)) return true;
  return false;
}

/** @param {string} rel */
function isAllowedRepositoriesImportSite(rel) {
  return isAllowedDrizzleSite(rel);
}

/** @param {string} dir @returns {string[]} */
function listAllSources(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listAllSources(full));
    } else if (SOURCE_RE.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** @type {string[]} */
const invariantViolations = [];

for (const file of listAllSources(root)) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");

  if (DRIZZLE_NEW_RE.test(text) && !isAllowedDrizzleSite(rel)) {
    invariantViolations.push(
      `${rel}: \`new Drizzle*\` outside allowed sites — use @auction/persistence or apps/*/src/container/`,
    );
  }

  if (
    rel.startsWith("apps/api/src/services/") &&
    !isTestSource(rel) &&
    rel !== "apps/api/src/services/domain-event.publisher.ts" &&
    PUBLISH_TX_RE.test(text)
  ) {
    invariantViolations.push(
      `${rel}: transactional \`publish(tx)\` — route through IDomainEventSink / domain-event.publisher.ts`,
    );
  }
}

if (invariantViolations.length > 0) {
  console.error("Architecture invariant violations detected:\n");
  for (const v of invariantViolations) {
    console.error(`  ${v}`);
  }
  console.error("\nSee scripts/check-layers.mjs for allowed Drizzle and publish(tx) sites.");
  process.exit(1);
}

// ─── Persistence subpath imports (Phase F3) ─────────────────────────────────

const ROOT_PERSISTENCE_RE = /^@auction\/persistence$/;
const REPOSITORIES_PERSISTENCE_RE = /^@auction\/persistence\/repositories$/;

/** @type {string[]} */
const persistenceImportViolations = [];

for (const file of listAllSources(join(root, "apps"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isTestSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;
    if (ROOT_PERSISTENCE_RE.test(specifier)) {
      persistenceImportViolations.push(
        `${rel}: root barrel \`@auction/persistence\` — use @auction/persistence/interfaces, /lib, or /repositories (container only)`,
      );
    }
    if (REPOSITORIES_PERSISTENCE_RE.test(specifier) && !isAllowedRepositoriesImportSite(rel)) {
      persistenceImportViolations.push(
        `${rel}: \`@auction/persistence/repositories\` outside container/tests/integration support`,
      );
    }
  }
}

if (persistenceImportViolations.length > 0) {
  console.error("Persistence import violations detected:\n");
  for (const v of persistenceImportViolations) {
    console.error(`  ${v}`);
  }
  console.error(
    "\nUse subpath imports: interfaces for ports, lib for mappers/helpers, repositories only in container/**.",
  );
  process.exit(1);
}

// ─── Worker job DIP (Phase F6) ───────────────────────────────────────────────

const WORKER_JOB_DB_PARAM_RE = /\bdb\s*:\s*(?:Db|Database|WorkerDb)\b/;

/** @param {string} rel */
function isWorkerJobSource(rel) {
  return (
    rel.startsWith("apps/worker/src/jobs/") &&
    !isTestSource(rel) &&
    !rel.startsWith("apps/worker/src/container/")
  );
}

/** @type {string[]} */
const workerJobDbViolations = [];

for (const file of listAllSources(join(root, "apps/worker/src/jobs"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (!isWorkerJobSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  if (WORKER_JOB_DB_PARAM_RE.test(text)) {
    workerJobDbViolations.push(
      `${rel}: raw \`db: Db\` in worker job — inject a repository port from create-worker-repositories.ts`,
    );
  }
}

if (workerJobDbViolations.length > 0) {
  console.error("Worker job DIP violations detected:\n");
  for (const v of workerJobDbViolations) {
    console.error(`  ${v}`);
  }
  console.error("\nWorker jobs must use ports wired from apps/worker/src/container/.");
  process.exit(1);
}

// ─── API routes must not import @auction/db (SOLID DIP) ─────────────────────

const DB_IMPORT_RE = /^@auction\/db(\/|$)/;

/** @type {string[]} */
const apiRouteDbViolations = [];

for (const file of listAllSources(join(root, "apps/api/src/routes"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isTestSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier && DB_IMPORT_RE.test(specifier)) {
      apiRouteDbViolations.push(`${rel}: imports "${specifier}" — routes must use container ports`);
    }
  }
}

if (apiRouteDbViolations.length > 0) {
  console.error("API route DB import violations detected:\n");
  for (const v of apiRouteDbViolations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

// ─── API routes must not import full Container (DIP at HTTP edge) ────────────

const FULL_CONTAINER_IMPORT_RE = /import\s+type\s+\{\s*Container\s*\}/;

/** @type {string[]} */
const fullContainerRouteViolations = [];

for (const file of listAllSources(join(root, "apps/api/src/routes"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isTestSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  if (FULL_CONTAINER_IMPORT_RE.test(text)) {
    fullContainerRouteViolations.push(
      `${rel}: imports full \`Container\` — use a Container*RoutesSlice from container-slices.ts`,
    );
  }
}

if (fullContainerRouteViolations.length > 0) {
  console.error("Full Container route import violations detected:\n");
  for (const v of fullContainerRouteViolations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("check-layers: ok (no layering violations)");
