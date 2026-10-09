#!/usr/bin/env node
/**
 * Copy LAX favicons from packages/branding/public/favicons into deploy surfaces.
 * Source of truth: packages/branding/public/favicons (from thelax.art /images/f-icons).
 *
 * Usage: node scripts/vendor/lax-favicons.mjs
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(repoRoot, "packages/branding/public/favicons");

const targets = [
  join(repoRoot, "apps/shop/public/favicons"),
  join(repoRoot, "apps/shop-admin/public/favicons"),
  join(repoRoot, "packages/auth/src/hosted-auth/assets/favicons"),
];

if (!existsSync(source)) {
  console.error(`Missing favicon source directory: ${source}`);
  process.exit(1);
}

for (const target of targets) {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`Synced favicons → ${target}`);
}
