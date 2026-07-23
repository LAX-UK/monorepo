#!/usr/bin/env node
/**
 * Prints controlled ownership flip order and rollback env pairs (no env changes).
 */
console.log("=== Controlled ownership cutover (staging/production) ===\n");
console.log("Preconditions: staging acceptance table complete + Engineering/Ops sign-off.\n");
console.log("Stage A — Finance cron → worker");
console.log(
  "  Set FINANCE_CRON_EXECUTION_OWNER=worker, FINANCE_CRON_API_ROLLBACK=false on API+worker",
);
console.log("  Keep XERO_API_WRITES_DISABLED=true on API during canary");
console.log(
  "  Rollback: FINANCE_CRON_EXECUTION_OWNER=api_rollback, FINANCE_CRON_API_ROLLBACK=true\n",
);
console.log("Stage B — Lifecycle → worker (keep absentee on API rollback)");
console.log("  Set LIFECYCLE_EXECUTION_OWNER=worker on API+worker");
console.log("  Observe worker:heartbeat:lot-lifecycle for 24h");
console.log("  Rollback: LIFECYCLE_EXECUTION_OWNER=api on both\n");
console.log("Stage C — Absentee replay → worker");
console.log(
  "  Set ABSENTEE_REPLAY_OWNER=worker (requires KYC threshold enforcement for worker bids)",
);
console.log(
  "  Rollback: ABSENTEE_REPLAY_OWNER=api_rollback before re-enabling worker lifecycle if needed\n",
);
console.log("See docs/runbooks/worker-runtime-cutover.md for full detail.");
