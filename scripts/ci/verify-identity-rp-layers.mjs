#!/usr/bin/env node
/**
 * Layer rules for @auction/identity-rp live outside scripts/check-layers.mjs so
 * monorepo-only RP work does not require lax-identity closure sync.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "../..");
const rpDir = join(root, "packages/identity-rp/src");

const rules = [
  {
    label: "packages/identity-rp must not import from apps/**",
    forbidden: [
      /^@auction\/(api|web|worker|ws|auth-app|shop-identity|event)(\/|$)/,
      /(^|\/)apps\//,
    ],
  },
  {
    label: "packages/identity-rp must stay RP-library scoped",
    forbidden: [
      /^@auction\/(auth|identity-db|db|persistence|domain)(\/|$)/,
      /^next(\/|$)/,
      /^react(\/|$)/,
      /^hono(\/|$)/,
    ],
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(path, out);
    } else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const importRe =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const violations = [];
for (const file of walk(rpDir)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(importRe)) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;
    for (const rule of rules) {
      if (rule.forbidden.some((re) => re.test(spec))) {
        violations.push(`${relative(root, file)}: ${rule.label} (${spec})`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`verify-identity-rp-layers failed:\n${violations.join("\n")}`);
  process.exit(1);
}

console.log("verify-identity-rp-layers: ok");
