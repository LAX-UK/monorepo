#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP } from "../../packages/background-runtime/dist/runtime-ownership-smoke-gate-map.js";
import { RUNTIME_OWNERSHIP_SMOKE_GATES } from "../../packages/background-runtime/dist/smoke-gates.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

for (const gate of RUNTIME_OWNERSHIP_SMOKE_GATES) {
  const rel = RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP[gate];
  if (!rel) {
    console.error(`Smoke gate missing suite mapping: ${gate}`);
    process.exit(1);
  }
  const abs = join(repoRoot, rel);
  if (!existsSync(abs)) {
    console.error(`Smoke gate suite missing: ${rel} (${gate})`);
    process.exit(1);
  }
}

const suitePaths = [...new Set(Object.values(RUNTIME_OWNERSHIP_SMOKE_GATE_SUITE_MAP))].map((rel) =>
  join(repoRoot, rel),
);

const jsonOut = join(repoRoot, "tmp/runtime-ownership-smoke-vitest.json");
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

/** Vitest JSON `numPendingTests` includes `skipIf` skips; classify from assertion status. */
function summarizeAssertions(report) {
  let failed = 0;
  let todo = 0;
  let passed = 0;
  for (const file of report.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      if (t.status === "failed") failed++;
      else if (t.status === "pending" || t.status === "todo") todo++;
      else if (t.status === "passed") passed++;
    }
  }
  return { failed, todo, passed };
}

const executed = report.numTotalTests ?? 0;
if (executed === 0) {
  console.error("Runtime ownership smoke gates executed zero tests");
  process.exit(1);
}

const { failed, todo, passed } = summarizeAssertions(report);
if (failed > 0) {
  console.error(`Smoke gates failed: ${failed} assertion(s)`);
  process.exit(1);
}
if (todo > 0) {
  console.error(`Smoke gates had ${todo} pending/todo test(s)`);
  process.exit(1);
}
if (passed === 0) {
  console.error("Runtime ownership smoke gates had no passing assertions");
  process.exit(1);
}

console.log(`Runtime ownership smoke gates passed (${passed} assertions, ${executed} total)`);
