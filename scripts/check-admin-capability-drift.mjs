#!/usr/bin/env node
/**
 * Prevents inline capability strings in admin web and API route code.
 * Use @auction/types *_ACCESS constants and require-capability middleware instead.
 *
 * LAX Admin (shop-admin and shop-api) follows the same rule for the client scope: the nav and
 * the route both ask `clientListScope` in @auction/shop-domain instead of spelling the
 * capability, so a link and the route behind it cannot disagree.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");
const API_ROUTES = path.join(ROOT, "apps/api/src/routes");
const SHOP_ADMIN_SRC = path.join(ROOT, "apps/shop-admin/src");
const SHOP_API_ROUTES = path.join(ROOT, "apps/shop-api/src/routes");

const WEB_SCAN_ROOTS = [
  path.join(WEB_SRC, "app/admin"),
  path.join(WEB_SRC, "components/admin"),
  path.join(WEB_SRC, "lib/admin"),
  path.join(WEB_SRC, "components/layout/staff-nav.ts"),
];

const INLINE_CAPABILITY =
  /"(?:platform\.admin\.full|finance\.read|finance\.(?:platform\.write|entity\.write|write)|payout\.(?:read|process|reverse)|user\.invite|artist\.(?:read|review|merge|delete)|catalogue\.write|auction\.manage|specialist\.appraise|operations\.fulfilment|content\.write|support\.respond|legal_entity\.read|client\.read|bids\.read|audit\.read_pii|aml\.review|compliance\.mlro)"/g;

const INLINE_SHOP_CLIENT_CAPABILITY = /"client\.read_(?:all|assigned)"/g;

const SKIP_SUFFIX = [".test.ts", ".test.tsx"];

const WEB_ALLOWLIST = new Set([
  "lib/navigation/staff-nav-access.ts",
  "lib/admin/staff-capabilities.ts",
  "lib/admin/capability-presenter.ts",
]);

function isSkipped(file) {
  return SKIP_SUFFIX.some((s) => file.endsWith(s));
}

async function walk(fileOrDir, out = []) {
  const { stat } = await import("node:fs/promises");
  const st = await stat(fileOrDir);
  if (st.isFile()) {
    if ((fileOrDir.endsWith(".ts") || fileOrDir.endsWith(".tsx")) && !isSkipped(fileOrDir)) {
      out.push(fileOrDir);
    }
    return out;
  }
  for (const ent of await readdir(fileOrDir, { withFileTypes: true })) {
    await walk(path.join(fileOrDir, ent.name), out);
  }
  return out;
}

function stripAllowedApiInlineChecks(text) {
  return text
    .split("\n")
    .filter((line) => !(line.includes("includePii") && line.includes("audit.read_pii")))
    .join("\n");
}

function findInlineViolations(text) {
  return text.match(INLINE_CAPABILITY) ?? [];
}

const violations = [];

for (const root of WEB_SCAN_ROOTS) {
  const files = await walk(root);
  for (const file of files) {
    const rel = path.relative(WEB_SRC, file);
    if (WEB_ALLOWLIST.has(rel)) continue;
    const matches = findInlineViolations(await readFile(file, "utf8"));
    if (matches.length) {
      const unique = [...new Set(matches)];
      violations.push(`web/${rel}: inline capability string(s) ${unique.join(", ")}`);
    }
  }
}

// Admin route files at the top level, the per-area files under routes/admin, and the payment
// routes that admin screens call (capture and refund).
const apiRouteFiles = [
  ...(await readdir(API_ROUTES, { withFileTypes: true }))
    .filter(
      (ent) =>
        ent.isFile() &&
        ent.name.startsWith("admin") &&
        ent.name.endsWith(".ts") &&
        !isSkipped(ent.name),
    )
    .map((ent) => path.join(API_ROUTES, ent.name)),
  ...(await walk(path.join(API_ROUTES, "admin"))),
  path.join(API_ROUTES, "payments.ts"),
];
for (const file of apiRouteFiles) {
  const text = stripAllowedApiInlineChecks(await readFile(file, "utf8"));
  const matches = findInlineViolations(text);
  if (matches.length) {
    const unique = [...new Set(matches)];
    violations.push(
      `api/src/routes/${path.relative(API_ROUTES, file)}: inline capability string(s) ${unique.join(", ")}`,
    );
  }
}

for (const [label, root] of [
  ["shop-admin", SHOP_ADMIN_SRC],
  ["shop-api/routes", SHOP_API_ROUTES],
]) {
  for (const file of await walk(root)) {
    const matches = (await readFile(file, "utf8")).match(INLINE_SHOP_CLIENT_CAPABILITY) ?? [];
    if (matches.length) {
      const unique = [...new Set(matches)];
      violations.push(
        `${label}/${path.relative(root, file)}: inline client capability ${unique.join(", ")}; use clientListScope from @auction/shop-domain`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("error: inline admin capability strings — use shared *_ACCESS / middleware:\n");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("admin capability drift: ok");
