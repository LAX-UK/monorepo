#!/usr/bin/env node
/**
 * Enforces the Node major version from repo-root .nvmrc.
 * Playwright test discovery hangs on Node 25+; CI and docs require Node 22.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function readRequiredNodeVersion(repoRootOverride = repoRoot) {
  return readFileSync(join(repoRootOverride, ".nvmrc"), "utf8").trim();
}

export function readRequiredNodeMajor(repoRootOverride = repoRoot) {
  return readRequiredNodeVersion(repoRootOverride).split(".")[0];
}

export function assertRepoNodeVersion(options = {}) {
  const { tool = "this script", repoRoot: root = repoRoot } = options;
  const required = readRequiredNodeVersion(root);
  const requiredMajor = required.split(".")[0];
  const currentMajor = process.versions.node.split(".")[0];

  if (currentMajor !== requiredMajor) {
    console.error(
      `${tool} requires Node ${required} (see .nvmrc). Current: ${process.versions.node}.\n` +
        `Run: nvm use ${required} — Playwright test discovery hangs on Node 25+.`,
    );
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  assertRepoNodeVersion();
}
