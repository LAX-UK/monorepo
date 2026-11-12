import assert from "node:assert/strict";
import { test } from "node:test";
import {
  baselineKey,
  buildBaseline,
  ratchetLines,
  ratchetResult,
  ratchetTable,
  refreshBaseline,
} from "./route-js-ratchet-rule.mjs";

const row = (overrides = {}) => ({
  app: "apps/web",
  route: "/(marketing)/page",
  gzipKb: 500.04,
  parsedKb: 1500.01,
  frameKb: 430,
  pageKb: 70.04,
  duplicateCount: 12,
  duplicateKb: 40.02,
  files: 20,
  ...overrides,
});

const TRACKED = { "apps/web /(marketing)/page": { label: "Home", targetKb: 300 } };

test("baselineKey joins the app and the route key", () => {
  assert.equal(baselineKey(row()), "apps/web /(marketing)/page");
});

test("buildBaseline records sizes rounded up to 0.1 KB with the label and target", () => {
  const baseline = buildBaseline({
    rows: [row()],
    tracked: TRACKED,
    toleranceKb: 1,
    measuredWith: "test",
  });
  assert.deepEqual(baseline.routes["apps/web /(marketing)/page"], {
    label: "Home",
    targetKb: 300,
    gzipKb: 500.1,
    parsedKb: 1500.1,
    frameKb: 430,
    pageKb: 70.1,
    duplicateCount: 12,
    duplicateKb: 40.1,
    files: 20,
  });
});

test("buildBaseline refuses a tracked route that is not in the build", () => {
  assert.throws(
    () => buildBaseline({ rows: [], tracked: TRACKED, toleranceKb: 1, measuredWith: "test" }),
    /not in the build/,
  );
});

test("refreshBaseline keeps labels and targets and updates sizes", () => {
  const baseline = buildBaseline({
    rows: [row()],
    tracked: TRACKED,
    toleranceKb: 1,
    measuredWith: "test",
  });
  const refreshed = refreshBaseline({ rows: [row({ gzipKb: 400 })], baseline, apps: ["apps/web"] });
  const entry = refreshed.routes["apps/web /(marketing)/page"];
  assert.equal(entry.gzipKb, 400);
  assert.equal(entry.targetKb, 300);
  assert.equal(entry.label, "Home");
  assert.equal(refreshed.toleranceKb, 1);
});

const baseline = buildBaseline({
  rows: [row()],
  tracked: TRACKED,
  toleranceKb: 1,
  measuredWith: "test",
});
const apps = ["apps/web"];

test("a route within the tolerance of its ratchet passes", () => {
  const result = ratchetResult({ rows: [row({ gzipKb: 501 })], baseline, apps });
  assert.deepEqual([result.over, result.missing, result.lowered], [[], [], []]);
});

test("a route above its ratchet plus tolerance is over", () => {
  const result = ratchetResult({ rows: [row({ gzipKb: 501.5 })], baseline, apps });
  assert.equal(result.over.length, 1);
  assert.match(ratchetLines(result)[0], /^error: Home .* over its ratchet of 500\.1 KB/);
});

test("a route well below its ratchet is a notice to lower it, not a failure", () => {
  const result = ratchetResult({ rows: [row({ gzipKb: 450 })], baseline, apps });
  assert.equal(result.over.length, 0);
  assert.match(ratchetLines(result)[0], /^::notice .*Lower it with --write-baseline/);
});

test("a tracked route missing from an audited app is an error; other apps are not judged", () => {
  assert.equal(ratchetResult({ rows: [], baseline, apps }).missing.length, 1);
  assert.deepEqual(ratchetResult({ rows: [], baseline, apps: ["apps/shop"] }).missing, []);
});

test("ratchetTable shows measured, ratchet, target and what is left to cut", () => {
  const table = ratchetTable({ rows: [row()], baseline, apps });
  assert.match(table, /Home\s+500\.0 KB\s+500\.1 KB\s+300 KB\s+200\.0 KB/);
});

test("refreshBaseline leaves the routes of unmeasured apps as recorded", () => {
  const both = {
    ...baseline,
    routes: { ...baseline.routes, "apps/shop /page": { label: "Shop", targetKb: 9, gzipKb: 77 } },
  };
  const refreshed = refreshBaseline({ rows: [row({ gzipKb: 400 })], baseline: both, apps });
  assert.equal(refreshed.routes["apps/shop /page"].gzipKb, 77);
  assert.equal(refreshed.routes["apps/web /(marketing)/page"].gzipKb, 400);
});
