/**
 * Shop-api-only layer boundaries (not part of the lax-identity closure).
 * Keeps routes, scheduler tasks, and shop-ops CLI off db/schema/infrastructure imports.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", "coverage"]);
const SOURCE_RE = /\.(ts|tsx)$/;
const TEST_RE = /\.(test|spec|integration\.test)\.(ts|tsx)$/;
const SPECIFIER_RE =
  /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

function shouldSkipDirEntry(entry) {
  if (SKIP_DIRS.has(entry)) return true;
  if (entry.startsWith(".tmp")) return true;
  return false;
}

/** @param {string} rel */
function isTestSource(rel) {
  return TEST_RE.test(rel);
}

/** @param {string} dir @returns {string[]} */
function listAllSources(dir) {
  /** @type {string[]} */
  const out = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const entry of readdirSync(dir)) {
    if (shouldSkipDirEntry(entry)) continue;
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

const SHOP_API_DB_IMPORT_RE = /^@auction\/db(\/|$)/;
const SHOP_API_DRIZZLE_RE = /^drizzle-orm(\/|$)/;

/** @type {string[]} */
const shopApiRouteViolations = [];
for (const file of listAllSources(join(root, "apps/shop-api/src/routes"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isTestSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;
    if (SHOP_API_DB_IMPORT_RE.test(specifier) || SHOP_API_DRIZZLE_RE.test(specifier)) {
      shopApiRouteViolations.push(
        `${rel}: imports "${specifier}" — shop-api routes must use container ports only`,
      );
    }
    if (specifier.includes("infrastructure")) {
      shopApiRouteViolations.push(
        `${rel}: imports "${specifier}" — shop-api routes must not import infrastructure`,
      );
    }
  }
}

/** @type {string[]} */
const shopApiSchedulerViolations = [];
for (const file of listAllSources(join(root, "apps/shop-api/src/scheduler/tasks"))) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isTestSource(rel)) continue;
  const text = readFileSync(file, "utf8");
  if (SHOP_API_DRIZZLE_RE.test(text) || /from\s+["']@auction\/db\/schema["']/.test(text)) {
    shopApiSchedulerViolations.push(
      `${rel}: scheduler task must delegate to an application handler (no direct schema access)`,
    );
  }
}

/** @type {string[]} */
const shopApiScriptViolations = [];
const shopOpsScript = join(root, "apps/shop-api/src/scripts/shop-ops.ts");
if (statSync(shopOpsScript, { throwIfNoEntry: false })?.isFile()) {
  const rel = relative(root, shopOpsScript).replace(/\\/g, "/");
  const text = readFileSync(shopOpsScript, "utf8");
  for (const match of text.matchAll(SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;
    if (
      SHOP_API_DB_IMPORT_RE.test(specifier) ||
      SHOP_API_DRIZZLE_RE.test(specifier) ||
      specifier.includes("infrastructure")
    ) {
      shopApiScriptViolations.push(
        `${rel}: imports "${specifier}" — shop-ops must use container/handlers only`,
      );
    }
  }
}

if (shopApiRouteViolations.length > 0) {
  console.error("Shop API route boundary violations detected:\n");
  for (const v of shopApiRouteViolations) console.error(`  ${v}`);
  process.exit(1);
}
if (shopApiSchedulerViolations.length > 0) {
  console.error("Shop API scheduler boundary violations detected:\n");
  for (const v of shopApiSchedulerViolations) console.error(`  ${v}`);
  process.exit(1);
}
if (shopApiScriptViolations.length > 0) {
  console.error("Shop API script boundary violations detected:\n");
  for (const v of shopApiScriptViolations) console.error(`  ${v}`);
  process.exit(1);
}

/** @type {string[]} */
const shopApiDomainApplicationViolations = [];
const SHOP_API_LAYER_DIRS = [
  join(root, "apps/shop-api/src/domain"),
  join(root, "apps/shop-api/src/application"),
];
for (const dir of SHOP_API_LAYER_DIRS) {
  for (const file of listAllSources(dir)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    if (isTestSource(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(SPECIFIER_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) continue;
      if (SHOP_API_DB_IMPORT_RE.test(specifier) || SHOP_API_DRIZZLE_RE.test(specifier)) {
        shopApiDomainApplicationViolations.push(
          `${rel}: imports "${specifier}" — shop-api domain/application must not import db or drizzle`,
        );
      }
    }
  }
}

if (shopApiDomainApplicationViolations.length > 0) {
  console.error("Shop API domain/application boundary violations detected:\n");
  for (const v of shopApiDomainApplicationViolations) console.error(`  ${v}`);
  process.exit(1);
}

const SHOP_ADMIN_FORBIDDEN = [/^ioredis(\/|$)/, /^@auction\/db(\/|$)/, /^drizzle-orm(\/|$)/];
const SHOP_ADMIN_LAYER_DIRS = [
  join(root, "apps/shop-admin/src/app"),
  join(root, "apps/shop-admin/src/lib"),
  join(root, "apps/shop-admin/src/server/domain"),
  join(root, "apps/shop-admin/src/server/application"),
];

function isShopAdminLayerFile(rel) {
  return (
    rel.startsWith("apps/shop-admin/src/app/") ||
    rel.startsWith("apps/shop-admin/src/lib/") ||
    rel.startsWith("apps/shop-admin/src/server/domain/") ||
    rel.startsWith("apps/shop-admin/src/server/application/")
  );
}

/** @type {string[]} */
const shopAdminLayerViolations = [];
for (const dir of SHOP_ADMIN_LAYER_DIRS) {
  for (const file of listAllSources(dir)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    if (isTestSource(rel)) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(SPECIFIER_RE)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) continue;
      if (SHOP_ADMIN_FORBIDDEN.some((re) => re.test(specifier))) {
        shopAdminLayerViolations.push(
          `${rel}: imports "${specifier}" — shop-admin routes/domain/application must use ports only`,
        );
      }
      if (isShopAdminLayerFile(rel) && specifier.includes("/infrastructure/")) {
        shopAdminLayerViolations.push(
          `${rel}: imports "${specifier}" — shop-admin handlers must call container use cases only`,
        );
      }
    }
    if (isShopAdminLayerFile(rel) && /\bprocess\.env\b/.test(text)) {
      shopAdminLayerViolations.push(
        `${rel}: reads process.env — shop-admin env belongs in config.ts composition root only`,
      );
    }
  }
}

if (shopAdminLayerViolations.length > 0) {
  console.error("Shop admin layer boundary violations detected:\n");
  for (const v of shopAdminLayerViolations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("check-shop-api-layers: ok");
