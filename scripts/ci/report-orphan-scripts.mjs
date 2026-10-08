#!/usr/bin/env node
/**
 * Report scripts under scripts/ci not referenced from workflows, package.json, or other scripts.
 * Non-blocking until the allowlist covers intentional runbook-only tools.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ALLOWLIST = new Set([
  "report-orphan-scripts.mjs",
  "run-pr-ci-local.mjs",
  "classify-working-tree.mjs",
  "create-release-backup-ref.mjs",
  "record-release-evidence.mjs",
  "staging-cutover-preflight.mjs",
  "update-visual-baselines.mjs",
  "pipeline-stats.mjs",
]);

function collectFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "identity-recovery") continue;
      collectFiles(path, acc);
    } else if (entry.name.endsWith(".mjs")) {
      acc.push(path);
    }
  }
  return acc;
}

function haystack() {
  const parts = [];
  parts.push(readFileSync(join(ROOT, "package.json"), "utf8"));
  for (const dir of [".github/workflows", ".github/actions"]) {
    for (const file of collectFiles(join(ROOT, dir))) {
      parts.push(readFileSync(file, "utf8"));
    }
  }
  for (const file of collectFiles(join(ROOT, "scripts/ci"))) {
    parts.push(readFileSync(file, "utf8"));
  }
  return parts.join("\n");
}

function main() {
  const refs = haystack();
  const scripts = collectFiles(join(ROOT, "scripts/ci")).map((p) => p.split("/scripts/ci/")[1]);
  const orphans = scripts.filter((name) => {
    if (ALLOWLIST.has(name) || name.endsWith(".test.mjs")) return false;
    const needle = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(needle).test(refs);
  });
  if (orphans.length === 0) {
    console.log("orphan-scripts: none");
    return;
  }
  console.log("orphan-scripts (review allowlist or add references):");
  for (const name of orphans.sort()) {
    console.log(`  - ${name}`);
  }
  process.exitCode = process.env.CI_ORPHAN_SCRIPTS_STRICT === "true" ? 1 : 0;
}

main();
