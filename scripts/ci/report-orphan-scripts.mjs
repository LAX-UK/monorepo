#!/usr/bin/env node
/**
 * Report scripts under scripts/ci not referenced from workflows, package.json, or other scripts.
 * Non-blocking until the allowlist covers intentional runbook-only tools.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
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

function walkFiles(dir, acc = [], filter = () => true) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, acc, filter);
    } else if (filter(path)) {
      acc.push(path);
    }
  }
  return acc;
}

function collectCiScripts() {
  return walkFiles(join(ROOT, "scripts/ci"), [], (p) => p.endsWith(".mjs"));
}

function appendFiles(parts, files) {
  for (const file of files) {
    parts.push(readFileSync(file, "utf8"));
  }
}

function haystack() {
  const parts = [];
  appendFiles(
    parts,
    walkFiles(join(ROOT, ".github"), [], (p) => /\.(ya?ml|json|md)$/.test(p)),
  );
  appendFiles(
    parts,
    walkFiles(ROOT, [], (p) => p.endsWith("package.json")),
  );
  appendFiles(
    parts,
    walkFiles(ROOT, [], (p) => /Dockerfile$/.test(p)),
  );
  appendFiles(
    parts,
    walkFiles(join(ROOT, "docs/runbooks"), [], () => true),
  );
  for (const file of collectCiScripts()) {
    parts.push(readFileSync(file, "utf8"));
  }
  return parts.join("\n");
}

function main() {
  const refs = haystack();
  const scripts = collectCiScripts().map((p) => p.split("/scripts/ci/")[1]);
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
