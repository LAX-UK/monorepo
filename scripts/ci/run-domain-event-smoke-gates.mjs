#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMAIN_EVENT_SMOKE_GATE_SUITE_MAP } from "../../packages/background-runtime/dist/domain-event-smoke-gate-map.js";
import { DOMAIN_EVENT_SMOKE_GATES } from "../../packages/background-runtime/dist/domain-event-smoke-gates.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

for (const gate of DOMAIN_EVENT_SMOKE_GATES) {
  const rel = DOMAIN_EVENT_SMOKE_GATE_SUITE_MAP[gate];
  if (!rel) {
    console.error(`Domain event smoke gate missing suite mapping: ${gate}`);
    process.exit(1);
  }
  const abs = join(repoRoot, rel);
  if (!existsSync(abs)) {
    console.error(`Domain event smoke gate suite missing: ${rel} (${gate})`);
    process.exit(1);
  }
}

const suitePaths = [...new Set(Object.values(DOMAIN_EVENT_SMOKE_GATE_SUITE_MAP))].map((rel) =>
  join(repoRoot, rel),
);

const jsonOut = join(repoRoot, "tmp/domain-event-smoke-vitest.json");
const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "--reporter=json", `--outputFile=${jsonOut}`, ...suitePaths],
  { cwd: repoRoot, encoding: "utf8" },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

if (!existsSync(jsonOut)) {
  console.error("Vitest JSON report missing");
  process.exit(1);
}

const report = JSON.parse(readFileSync(jsonOut, "utf8"));
const executed = report.numTotalTests ?? 0;
if (executed === 0) {
  console.error("Domain event smoke gates executed zero tests");
  process.exit(1);
}

const pending = report.numPendingTests ?? 0;
const skipped = (report.numSkippedTests ?? 0) + (report.numTodoTests ?? 0);
if (pending > 0 || skipped > 0) {
  console.error(`Domain event smoke gates had pending=${pending} skipped/todo=${skipped}`);
  process.exit(1);
}

console.log(`Domain event smoke gates passed (${executed} tests)`);
