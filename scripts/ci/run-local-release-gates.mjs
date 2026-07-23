#!/usr/bin/env node
/**
 * Local release gate bundle (mirrors key CI steps). Requires Postgres + REDIS_URL for smoke gates.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node", ["scripts/check-layers.mjs"]);
run("node", ["apps/api/scripts/check-route-dip-coverage.mjs"]);
run("node", ["scripts/ci/verify-cutover-readiness.mjs"]);
run("pnpm", ["--filter", "@auction/background-runtime", "build"]);
run("node", ["scripts/ci/run-runtime-ownership-smoke-gates.mjs"]);
run("node", ["scripts/ci/run-domain-event-smoke-gates.mjs"]);
console.log("Local release gates passed (run pnpm ci:verify for full monorepo matrix).");
