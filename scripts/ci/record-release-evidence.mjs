#!/usr/bin/env node
/**
 * Records local release validation evidence (commit SHA, branch, dirty tree summary).
 * Append output to docs/runbooks/worker-runtime-cutover-acceptance-evidence.md manually or in CI logs.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function git(args) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) return "";
  return r.stdout.trim();
}

const sha = git(["rev-parse", "HEAD"]);
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
const dirty = git(["status", "--porcelain=v1"]);
const dirtyCount = dirty ? dirty.split("\n").length : 0;

console.log("=== Release validation evidence ===");
console.log(`timestamp: ${new Date().toISOString()}`);
console.log(`branch: ${branch}`);
console.log(`commit: ${sha}`);
console.log(`dirty_paths: ${dirtyCount}`);
if (dirtyCount > 0) {
  console.log("status: BLOCKED — working tree must be clean before release tag");
  process.exit(1);
}
console.log("status: clean tree — run pnpm ci:verify and pnpm ci:release-gates on this SHA");
console.log("Attach GitHub Actions CI workflow run URLs for the same commit SHA.");
