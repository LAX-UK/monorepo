#!/usr/bin/env node
/**
 * Rehearses mechanical Identity extraction without publishing artifacts.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Identity extraction rehearsal" });

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function run(label, command, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("Identity extractability", "pnpm", ["ci:identity-extractability"]);
run("Identity exit criteria", "pnpm", ["ci:identity-exit-criteria"]);
run("Repo split dry run", "bash", ["scripts/identity/repo-split.sh", "--dry-run"]);
run("Contracts build", "pnpm", ["--filter", "@auction/identity-contracts", "build"]);
run("Contracts test", "pnpm", ["--filter", "@auction/identity-contracts", "test"]);
run("Publish dry run", "bash", ["scripts/identity/publish-identity-contracts.sh", "--dry-run"]);

console.log("\nIdentity extraction rehearsal passed.");
