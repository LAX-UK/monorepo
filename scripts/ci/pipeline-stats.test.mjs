import assert from "node:assert/strict";
import test from "node:test";
import { percentile, summarizeRuns } from "./pipeline-stats.mjs";

test("percentile on sorted durations", () => {
  const sorted = [10, 20, 30, 40, 100];
  assert.equal(percentile(sorted, 50), 30);
  assert.equal(percentile(sorted, 90), 100);
});

test("summarizeRuns computes failure rate", () => {
  const summary = summarizeRuns([
    {
      status: "completed",
      conclusion: "success",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:10:00Z",
    },
    {
      status: "completed",
      conclusion: "failure",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:05:00Z",
    },
  ]);
  assert.equal(summary.success, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.failure_rate, 0.5);
});
