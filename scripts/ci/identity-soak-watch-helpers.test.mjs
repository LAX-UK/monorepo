import assert from "node:assert/strict";
import test from "node:test";
import { latestSuccessfulSoakRun } from "./identity-soak-watch-helpers.mjs";

test("latestSuccessfulSoakRun uses newest-first ordering from gh run list", () => {
  const runs = [
    { createdAt: "2026-09-28T13:00:00Z" },
    { createdAt: "2026-09-28T12:00:00Z" },
    { createdAt: "2026-09-28T11:00:00Z" },
  ];
  assert.equal(latestSuccessfulSoakRun(runs)?.createdAt, "2026-09-28T13:00:00Z");
  assert.equal(latestSuccessfulSoakRun([]), undefined);
});
