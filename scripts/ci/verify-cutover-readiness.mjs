#!/usr/bin/env node
/**
 * CI guard: repository defaults must stay on API/rollback ownership until ops flips env after canary.
 * Does not prove staging canary ran — see docs/runbooks/worker-runtime-cutover-acceptance-evidence.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readDefault(path, pattern) {
  const text = readFileSync(join(repoRoot, path), "utf8");
  const match = text.match(pattern);
  if (!match) {
    console.error(`Could not read default from ${path}`);
    process.exit(1);
  }
  return match[1];
}

function readBooleanDefault(path, pattern) {
  const text = readFileSync(join(repoRoot, path), "utf8");
  const match = text.match(pattern);
  if (!match) {
    console.error(`Could not read default from ${path}`);
    process.exit(1);
  }
  return match[1] === "true";
}

const apiLifecycle = readDefault(
  "apps/api/src/env.ts",
  /LIFECYCLE_EXECUTION_OWNER:\s*z\.enum\(\["api",\s*"worker"\]\)\.default\("(\w+)"\)/,
);
const apiAbsentee = readDefault(
  "apps/api/src/env.ts",
  /ABSENTEE_REPLAY_OWNER:\s*z\.enum\(\["api_rollback",\s*"worker"\]\)\.default\("(\w+)"\)/,
);
const apiFinanceOwner = readDefault(
  "apps/api/src/env.ts",
  /FINANCE_CRON_EXECUTION_OWNER:\s*z\.enum\(\["api_rollback",\s*"worker"\]\)\.default\("(\w+)"\)/,
);
const apiFinanceRollback = readBooleanDefault(
  "apps/api/src/env.ts",
  /FINANCE_CRON_API_ROLLBACK:[\s\S]*?\.default\((true|false)\)/,
);

const workerLifecycle = readDefault(
  "apps/worker/src/env.ts",
  /LIFECYCLE_EXECUTION_OWNER:\s*z\.enum\(\["api",\s*"worker"\]\)\.default\("(\w+)"\)/,
);
const workerAbsentee = readDefault(
  "apps/worker/src/env.ts",
  /ABSENTEE_REPLAY_OWNER:\s*z\.enum\(\["api_rollback",\s*"worker"\]\)\.default\("(\w+)"\)/,
);
const workerFinanceOwner = readDefault(
  "apps/worker/src/env.ts",
  /FINANCE_CRON_EXECUTION_OWNER:\s*z\.enum\(\["api_rollback",\s*"worker"\]\)\.default\("(\w+)"\)/,
);
const workerFinanceRollback = readBooleanDefault(
  "apps/worker/src/env.ts",
  /FINANCE_CRON_API_ROLLBACK:[\s\S]*?\.default\((true|false)\)/,
);

const failures = [];
if (apiLifecycle !== "api")
  failures.push(`API LIFECYCLE_EXECUTION_OWNER default must be api (got ${apiLifecycle})`);
if (apiAbsentee !== "api_rollback") {
  failures.push(`API ABSENTEE_REPLAY_OWNER default must be api_rollback (got ${apiAbsentee})`);
}
if (apiFinanceOwner !== "api_rollback") {
  failures.push(
    `API FINANCE_CRON_EXECUTION_OWNER default must be api_rollback (got ${apiFinanceOwner})`,
  );
}
if (!apiFinanceRollback) {
  failures.push("API FINANCE_CRON_API_ROLLBACK default must be true");
}
if (workerLifecycle !== "api") {
  failures.push(`Worker LIFECYCLE_EXECUTION_OWNER default must be api (got ${workerLifecycle})`);
}
if (workerAbsentee !== "api_rollback") {
  failures.push(
    `Worker ABSENTEE_REPLAY_OWNER default must be api_rollback (got ${workerAbsentee})`,
  );
}
if (workerFinanceOwner !== "api_rollback") {
  failures.push(
    `Worker FINANCE_CRON_EXECUTION_OWNER default must be api_rollback (got ${workerFinanceOwner})`,
  );
}
if (!workerFinanceRollback) {
  failures.push("Worker FINANCE_CRON_API_ROLLBACK default must be true");
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  "Cutover readiness: lifecycle api, absentee/finance api_rollback defaults, finance rollback enabled",
);
