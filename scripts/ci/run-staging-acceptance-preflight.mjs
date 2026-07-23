#!/usr/bin/env node
/**
 * Staging acceptance checklist runner (repository-side). Does not perform env flips.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function runNode(rel) {
  const r = spawnSync("node", [join(repoRoot, rel)], { cwd: repoRoot, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("=== Staging acceptance (manual evidence required) ===\n");
runNode("scripts/ci/staging-cutover-preflight.mjs");
console.log("\n=== Repository release evidence (requires clean tree) ===");
console.log("When the tree is clean, run: pnpm ci:record-evidence\n");
console.log(
  "Manual staging rows (fill docs/runbooks/worker-runtime-cutover-acceptance-evidence.md):",
);
console.log("1. Lifecycle shadow compare — domain_event + snapshot diff for one sale");
console.log("2. One-sale lifecycle canary — sale ID, lot statuses, BullMQ job IDs");
console.log("3. Absentee replay canary — lot ID, absentee rows, bid placement keys");
console.log("4. Reconciliation — no duplicate bids / domain events");
console.log(
  "5. Retry/DLQ — forced failure on lot-lifecycle or payout-settlement → failed_jobs + Redis DLQ",
);
console.log(
  "6. Rollback drill — restore api / api_rollback; verify API tick 409 when worker owns lifecycle",
);
console.log(
  "7. Stability window — 24–72h queue depth, DLQ rate, lifecycle lag, heartbeat freshness",
);
