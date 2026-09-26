import assert from "node:assert/strict";
import test from "node:test";
import {
  SOAK_MAX_GAP_MS,
  SOAK_WINDOW_MS,
  checkSequentialGaps,
  checkStartGap,
  filterWithinSoakWindow,
  isSoakWindowComplete,
  isWithinSoakWindow,
  soakWindowEndMs,
} from "./identity-soak-window.mjs";

test("soak window is 24 hours inclusive at end boundary", () => {
  const start = Date.parse("2026-09-24T14:23:08Z");
  const end = soakWindowEndMs(start);
  assert.equal(end - start, SOAK_WINDOW_MS);
  assert.equal(isWithinSoakWindow(start, start), true);
  assert.equal(isWithinSoakWindow(end, start), true);
  assert.equal(isWithinSoakWindow(end + 1, start), false);
  assert.equal(isWithinSoakWindow(start - 1, start), false);
});

test("filterWithinSoakWindow drops post-window cron samples", () => {
  const start = Date.parse("2026-09-24T14:23:08Z");
  const runs = [
    { at: "2026-09-25T14:12:25Z" },
    { at: "2026-09-25T17:22:04Z" },
    { at: "2026-09-24T16:52:11Z" },
  ];
  const inWindow = filterWithinSoakWindow(runs, (r) => Date.parse(r.at), start);
  assert.equal(inWindow.length, 2);
  assert.ok(inWindow.every((r) => r.at !== "2026-09-25T17:22:04Z"));
});

test("checkSequentialGaps flags gaps over 25 minutes", () => {
  const t0 = 0;
  const t1 = 20 * 60 * 1000;
  assert.deepEqual(checkSequentialGaps([t0, t1], SOAK_MAX_GAP_MS), { ok: true });
  const t2 = t1 + 26 * 60 * 1000;
  const bad = checkSequentialGaps([t0, t1, t2], SOAK_MAX_GAP_MS);
  assert.equal(bad.ok, false);
  assert.equal(bad.betweenIndex, 2);
});

test("checkStartGap requires first sample within 25 minutes of window start", () => {
  const start = 1_000_000;
  assert.deepEqual(checkStartGap(start + 10 * 60 * 1000, start, SOAK_MAX_GAP_MS), {
    ok: true,
  });
  const late = checkStartGap(start + 26 * 60 * 1000, start, SOAK_MAX_GAP_MS);
  assert.equal(late.ok, false);
});

test("isSoakWindowComplete after 24h elapsed", () => {
  const start = Date.parse("2026-09-24T14:23:08Z");
  assert.equal(isSoakWindowComplete(start + SOAK_WINDOW_MS, start), true);
  assert.equal(isSoakWindowComplete(start + SOAK_WINDOW_MS - 1, start), false);
});
