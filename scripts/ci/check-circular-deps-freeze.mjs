#!/usr/bin/env node
/**
 * Fails when circular-deps allowlist grows beyond the release baseline count.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(dir, "..");
const allowlist = JSON.parse(readFileSync(join(repoRoot, "circular-deps-allowlist.json"), "utf8"));
const baseline = JSON.parse(
  readFileSync(join(dir, "circular-deps-allowlist.baseline.json"), "utf8"),
);

const count = allowlist.allowedCycles.length;
const max = baseline.maxAllowedCycles;

if (count > max) {
  console.error(
    `circular-deps allowlist grew: ${count} cycles (baseline max ${max}). Fix cycles instead of expanding allowlist.`,
  );
  process.exit(1);
}

console.log(`circular-deps allowlist freeze: ok (${count}/${max} cycles)`);
