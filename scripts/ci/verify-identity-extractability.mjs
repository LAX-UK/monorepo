#!/usr/bin/env node
/**
 * Walks the workspace dependency closure of the extractable identity libraries and
 * fails when any transitive @auction/* package is outside the allowlist.
 *
 * Checked roots: @auction/auth-app and the extractable identity packages.
 *
 * Allowed @auction/* packages in those closures:
 *   @auction/auth, @auction/identity-contracts, @auction/identity-db,
 *   @auction/observability, @auction/config-ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

const ROOT_PACKAGES = [
  "@auction/auth-app",
  "@auction/auth",
  "@auction/identity-contracts",
  "@auction/identity-db",
];

/** @type {Set<string>} */
const ALLOWED_AUCTION_PACKAGES = new Set([
  "@auction/auth",
  "@auction/identity-contracts",
  "@auction/identity-db",
  "@auction/observability",
  "@auction/config-ts",
]);
/** Composition-root dependencies retained until their ports are fully externalized. */
const AUTH_APP_TRANSITIONAL_PACKAGES = new Set([
  "@auction/db",
  "@auction/email",
  "@auction/queues",
  "@auction/sms",
]);

/** @type {Map<string, string>} */
const packageJsonByName = new Map();

for (const base of ["apps", "packages"]) {
  const baseDir = join(root, base);
  if (!existsSync(baseDir)) continue;
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(baseDir, entry.name, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (typeof manifest.name === "string") {
      packageJsonByName.set(manifest.name, manifestPath);
    }
  }
}

/** @param {string} packageName @returns {Record<string, unknown> | null} */
function readManifest(packageName) {
  const manifestPath = packageJsonByName.get(packageName);
  if (!manifestPath) return null;
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/** @param {Record<string, unknown>} manifest */
function dependencyNames(manifest) {
  /** @type {string[]} */
  const names = [];
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const section = manifest[field];
    if (section && typeof section === "object") {
      names.push(...Object.keys(/** @type {Record<string, string>} */ (section)));
    }
  }
  return names;
}

/** @param {string} rootPackage */
function collectAuctionClosure(rootPackage) {
  /** @type {Map<string, string[]>} */
  const edges = new Map();
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {string[]} */
  const queue = [rootPackage];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const manifest = readManifest(current);
    if (!manifest) continue;

    /** @type {string[]} */
    const deps = [];
    for (const dep of dependencyNames(manifest)) {
      if (!dep.startsWith("@auction/")) continue;
      deps.push(dep);
      // Product adapters are intentionally leaves of the auth-app closure.
      if (ALLOWED_AUCTION_PACKAGES.has(dep) && packageJsonByName.has(dep)) {
        queue.push(dep);
      }
    }
    edges.set(current, deps);
  }

  return edges;
}

/** @type {string[]} */
const violations = [];
/** @type {Set<string>} */
const checked = new Set();

for (const rootPackage of ROOT_PACKAGES) {
  if (!packageJsonByName.has(rootPackage)) {
    console.error(`verify-identity-extractability: missing package ${rootPackage}`);
    process.exit(1);
  }
  const closure = collectAuctionClosure(rootPackage);
  for (const [from, deps] of closure.entries()) {
    checked.add(from);
    for (const dep of deps) {
      const isTransitionalAuthAppDependency =
        from === "@auction/auth-app" && AUTH_APP_TRANSITIONAL_PACKAGES.has(dep);
      if (!ALLOWED_AUCTION_PACKAGES.has(dep) && !isTransitionalAuthAppDependency) {
        violations.push(`${from} depends on forbidden ${dep}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Identity extractability dependency violations detected:\n");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error(
    `\nAllowed @auction/* packages in identity library closures: ${[...ALLOWED_AUCTION_PACKAGES].sort().join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `verify-identity-extractability: ok (${ROOT_PACKAGES.join(", ")} closures use only extractable @auction/* packages; checked ${checked.size} packages)`,
);
