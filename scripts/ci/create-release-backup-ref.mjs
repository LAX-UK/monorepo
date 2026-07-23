#!/usr/bin/env node
/**
 * Creates refs/backup/pre-release-<timestamp> pointing at a stash snapshot of the working tree.
 * Does not modify the working tree or stage files.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const refName = `refs/backup/pre-release-${stamp}`;

const stash = spawnSync("git", ["stash", "create", `pre-release-backup-${stamp}`], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (stash.status !== 0) {
  console.error(stash.stderr || stash.stdout);
  process.exit(stash.status ?? 1);
}
const sha = stash.stdout.trim();
if (!sha) {
  console.error("git stash create returned no object (empty tree?)");
  process.exit(1);
}

const update = spawnSync("git", ["update-ref", refName, sha], { cwd: repoRoot, encoding: "utf8" });
if (update.status !== 0) {
  console.error(update.stderr || update.stdout);
  process.exit(update.status ?? 1);
}

console.log(`Backup ref created: ${refName}`);
console.log(`Object: ${sha}`);
console.log("Recover with: git stash apply <sha>  OR  git checkout <sha> -- <paths>");
