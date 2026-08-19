/**
 * Enforces package layering (DIP direction between workspace layers):
 *   1. packages/persistence, packages/domain, packages/db must not import from apps/**.
 *   2. packages/domain must not import @auction/persistence or @auction/db.
 *   3. Identity extractability: packages/auth and apps/auth import boundaries,
 *      packages/auth must not import drizzle-orm, packages/identity-db must not
 *      import @auction/db or @auction/persistence.
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
    dir: "packages/auth",
    label: "packages/auth must not import from apps/**",
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
  {
    dir: "packages/bidding-runtime",
    label: "packages/bidding-runtime must not import from apps/**",
    forbiddenSpecifiers: [/^@auction\/(api|web|worker|ws|auth-app|event)$/, /(^|\/)apps\//],
  },
  {
    dir: "packages/identity-contracts",
    label: "packages/identity-contracts must not import from apps/** or @auction/db",
    forbiddenSpecifiers: [/^@auction\/(api|web|worker|ws|auth-app|event|db)(\/|$)/, /(^|\/)apps\//],
  },
  {
    dir: "packages/lot-lifecycle-app",
    label: "packages/lot-lifecycle-app must not import from apps/**",
    forbiddenSpecifiers: [/^@auction\/(api|web|worker|ws|auth-app|event)$/, /(^|\/)apps\//],
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

// ─── API Identity storage boundary ───────────────────────────────────────────

const IDENTITY_TABLE_IMPORT_RE =
  /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']@auction\/db\/schema["']/g;
const API_FORBIDDEN_IDENTITY_TABLES = new Set([
  "account",
  "session",
  "verification",
  "twoFactor",
  "oauthAccessToken",
  "oauthConsent",
  "jwksKey",
]);
const identityStorageViolations = [];

for (const sourceRoot of ["apps/api/src", "packages/persistence/src"]) {
  for (const file of listSources(join(root, sourceRoot))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IDENTITY_TABLE_IMPORT_RE)) {
      const imported = (match[1] ?? "")
        .split(",")
        .map((name) => name.trim().split(/\s+as\s+/)[0])
        .filter(Boolean);
      for (const table of imported) {
        if (API_FORBIDDEN_IDENTITY_TABLES.has(table)) {
          identityStorageViolations.push(
            `${relative(root, file)} imports Identity-owned table "${table}"`,
          );
        }
      }
    }
  }
}

if (identityStorageViolations.length > 0) {
  console.error("API Identity storage boundary violations detected:\n");
  for (const violation of identityStorageViolations) console.error(`  ${violation}`);
  process.exit(1);
}

/** @param {string} rel */
function isAllowedDrizzleSite(rel) {
  if (rel.startsWith("packages/persistence/")) return true;
  if (/^apps\/[^/]+\/src\/container\//.test(rel)) return true;
  if (/^apps\/[^/]+\/src\/container\.ts$/.test(rel)) return true;
  if (rel === "apps/api/src/services/payout/payout-helpers.ts") return true;
  if (rel === "packages/finance-runtime/src/payout/payout-helpers.ts") return true;
  if (rel === "apps/api/src/services/lot-transition-guards.ts") return true;
  if (/^apps\/worker\/src\/(container|finance|lifecycle|bidding)\//.test(rel)) return true;
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

// ─── API routes must not import concrete service facades (DIP at HTTP edge) ──

/** Concrete facade classes — routes must depend on segregated interfaces / slices. */
const ROUTE_FACADE_CLASS_NAMES = [
  "SaleroomService",
  "TelephoneBidBookingService",
  "PaymentService",
  "LotService",
  "SaleService",
];

/** @type {string[]} */
const concreteFacadeRouteViolations = [];

for (const file of listAllSources(join(root, "apps/api/src/routes"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isTestSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  for (const className of ROUTE_FACADE_CLASS_NAMES) {
    const importRe = new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${className}\\b`);
    if (importRe.test(text)) {
      concreteFacadeRouteViolations.push(
        `${rel}: imports concrete \`${className}\` — use a segregated interface or Container*RoutesSlice`,
      );
      break;
    }
  }
}

if (concreteFacadeRouteViolations.length > 0) {
  console.error("Concrete service facade route import violations detected:\n");
  for (const v of concreteFacadeRouteViolations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

// ─── Identity consumer boundary (D13) ───────────────────────────────────────

const IDENTITY_SERVER_IMPORT_RE = /^@auction\/auth\/server(\/|$)/;
const IDENTITY_CONSUMER_APPS = ["apps/shop-identity", "apps/ws"];

/** @type {string[]} */
const identityConsumerViolations = [];

for (const appDir of IDENTITY_CONSUMER_APPS) {
  const abs = join(root, appDir, "src");
  if (!statSync(abs, { throwIfNoEntry: false })?.isDirectory()) continue;
  for (const file of listAllSources(abs)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    if (isTestSource(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(SPECIFIER_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (specifier && IDENTITY_SERVER_IMPORT_RE.test(specifier)) {
        identityConsumerViolations.push(
          `${rel}: imports "${specifier}" — use @auction/identity-contracts instead`,
        );
      }
      if (appDir === "apps/shop-identity" && specifier && DB_IMPORT_RE.test(specifier)) {
        identityConsumerViolations.push(
          `${rel}: imports "${specifier}" — Shop Identity app must not access shared DB package`,
        );
      }
    }
  }
}

if (identityConsumerViolations.length > 0) {
  console.error("Identity consumer boundary violations detected:\n");
  for (const v of identityConsumerViolations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

// ─── Identity extractability (Phase 8) ────────────────────────────────────

const AUCTION_PKG_RE = /^@auction\//;
const IDENTITY_CONTRACTS_RE = /^@auction\/identity-contracts(\/|$)/;
const IDENTITY_DB_RE = /^@auction\/identity-db(\/|$)/;
const DRIZZLE_ORM_RE = /^drizzle-orm(\/|$)/;
const IDENTITY_DB_FORBIDDEN_RE = /^@auction\/(db|persistence)(\/|$)/;

/** @param {string} rel */
function isAuthPkgConsentStoreReexport(rel) {
  return rel === "packages/auth/src/ports/consent-store.ts";
}

const AUTH_APP_COMPOSITION_PRODUCT_DEPS = [
  /^@auction\/db(\/|$)/,
  /^@auction\/email(\/|$)/,
  /^@auction\/sms(\/|$)/,
  /^@auction\/persistence(\/|$)/,
  /^@auction\/queues(\/|$)/,
];

/** @param {string} rel */
function isAuthAppCompositionSite(rel) {
  return (
    /^apps\/auth\/src\/(container|infrastructure)\//.test(rel) || rel === "apps/auth/src/index.ts"
  );
}

/**
 * Existing service-layer storage dependencies. This list is deliberately
 * file-specific so new coupling fails CI and each entry can be removed as its
 * repository port is extracted.
 */
const AUTH_APP_TRANSITIONAL_IMPORTS = new Set([]);

/** @param {string} rel */
function isAuthAppCompositionAdapterSite(rel) {
  return isAuthAppCompositionSite(rel);
}

/** @param {string} rel @param {string} specifier */
function isAllowedPackagesAuthAuctionImport(rel, specifier) {
  if (IDENTITY_CONTRACTS_RE.test(specifier)) return true;
  if (IDENTITY_DB_RE.test(specifier) && isAuthPkgConsentStoreReexport(rel)) return true;
  return false;
}

/** @param {string} rel @param {string} specifier */
function isAllowedAppsAuthAuctionImport(rel, specifier) {
  if (IDENTITY_CONTRACTS_RE.test(specifier)) return true;
  // Composition root wires the extractable library and observability adapters.
  if (/^@auction\/auth(\/|$)/.test(specifier)) return true;
  if (/^@auction\/observability(\/|$)/.test(specifier)) return true;
  if (IDENTITY_DB_RE.test(specifier) && isAuthAppCompositionAdapterSite(rel)) return true;
  if (
    isAuthAppCompositionSite(rel) &&
    AUTH_APP_COMPOSITION_PRODUCT_DEPS.some((re) => re.test(specifier))
  ) {
    return true;
  }
  if (AUTH_APP_TRANSITIONAL_IMPORTS.has(`${rel}|${specifier}`)) return true;
  return false;
}

/** @type {string[]} */
const identityExtractabilityViolations = [];

for (const file of listSources(join(root, "packages/auth/src"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;
    if (AUCTION_PKG_RE.test(specifier) && !isAllowedPackagesAuthAuctionImport(rel, specifier)) {
      identityExtractabilityViolations.push(
        `${rel}: imports "${specifier}" — packages/auth may only import @auction/identity-contracts and re-export @auction/identity-db from ports/consent-store.ts`,
      );
    }
    if (DRIZZLE_ORM_RE.test(specifier)) {
      identityExtractabilityViolations.push(
        `${rel}: imports "${specifier}" — packages/auth must not import drizzle-orm (use ports + adapters in apps/auth or packages/identity-db)`,
      );
    }
  }
}

for (const file of listSources(join(root, "apps/auth/src"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  if (
    /import\s*\{[^}]*\bdomainEvent\b[^}]*\}\s*from\s*["']@auction\/db(?:\/schema)?["']/s.test(text)
  ) {
    identityExtractabilityViolations.push(
      `${rel}: imports domainEvent — apps/auth must publish identity events through IdentityEventPublisher`,
    );
  }
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;
    if (AUCTION_PKG_RE.test(specifier) && !isAllowedAppsAuthAuctionImport(rel, specifier)) {
      identityExtractabilityViolations.push(
        `${rel}: imports "${specifier}" — apps/auth may only import @auction/auth, @auction/identity-contracts, @auction/observability, and @auction/identity-db from container/** or infrastructure/**`,
      );
    }
  }
}

for (const file of listSources(join(root, "packages/identity-db"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isTestSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier && IDENTITY_DB_FORBIDDEN_RE.test(specifier)) {
      identityExtractabilityViolations.push(
        `${rel}: imports "${specifier}" — packages/identity-db must not depend on @auction/db or @auction/persistence`,
      );
    }
  }
}

if (identityExtractabilityViolations.length > 0) {
  console.error("Identity extractability violations detected:\n");
  for (const violation of identityExtractabilityViolations) {
    console.error(`  ${violation}`);
  }
  console.error(
    "\nSee scripts/check-layers.mjs (Identity extractability) and docs/architecture/09-lax-identity-boundary.md.",
  );
  process.exit(1);
}

console.log("check-layers: ok (no layering violations)");
