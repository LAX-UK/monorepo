#!/usr/bin/env node
/**
 * Prints staging cutover checklist and verifies repository cutover defaults locally.
 * Staging canaries, rollback drills, and production flips require authorized environment access.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function runNode(script) {
  const r = spawnSync("node", [script], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    process.exit(r.status ?? 1);
  }
  return r.stdout;
}

console.log("=== Staging / production cutover preflight (repository) ===\n");
runNode("scripts/ci/verify-cutover-readiness.mjs");
console.log(
  "\n=== Manual staging evidence (see docs/runbooks/worker-runtime-cutover-acceptance-evidence.md) ===",
);
console.log("- Lifecycle shadow compare for one sale");
console.log("- One-sale lifecycle canary (sale ID, job IDs, snapshots)");
console.log("- Absentee replay canary with bid idempotency check");
console.log("- Forced retry/DLQ observation (`failed_jobs` + Redis DLQ payload)");
console.log("- Rollback drill (restore api / api_rollback owners)");
console.log("- 24–72h stability window before ownership flip");
console.log(
  "\nRepository preflight passed. Complete manual rows before changing LIFECYCLE_EXECUTION_OWNER or ABSENTEE_REPLAY_OWNER in staging/production.",
);
