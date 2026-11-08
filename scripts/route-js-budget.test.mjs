import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetRows, firstLoadFiles, verdict } from "./route-js-budget.mjs";

const build = { rootMainFiles: ["static/chunks/main-app.js", "static/chunks/framework.js"] };
const app = {
  pages: {
    "/(marketing)/(home)/page": [
      "static/chunks/a.js",
      "static/css/a.css",
      "static/chunks/main-app.js",
    ],
  },
};

test("a route's first load is the root files and its own scripts, once each, without styles", () => {
  assert.deepEqual(firstLoadFiles(app, build, "/(marketing)/(home)/page"), [
    "static/chunks/main-app.js",
    "static/chunks/framework.js",
    "static/chunks/a.js",
  ]);
});

test("a route the build does not list has no first load", () => {
  assert.equal(firstLoadFiles(app, build, "/(marketing)/nope/page"), null);
});

const groups = [{ name: "public", budgetKb: 300, routes: ["/a", "/b", "/c"] }];
const sizes = { "/a": 250, "/b": 420, "/c": null };

test("rows carry each route's size against its group's budget", () => {
  assert.deepEqual(
    budgetRows(groups, (route) => sizes[route]).map((row) => [row.route, row.gzipKb, row.budgetKb]),
    [
      ["/a", 250, 300],
      ["/b", 420, 300],
      ["/c", null, 300],
    ],
  );
});

test("over budget and missing routes are warnings until enforced, then errors that fail", () => {
  const rows = budgetRows(groups, (route) => sizes[route]);
  const warned = verdict(rows, { enforce: false });
  assert.match(warned.lines[0], /^::warning::\/b loads 420 KB/);
  assert.match(warned.lines[1], /^::warning::\/c is not in the build manifest/);
  assert.equal(warned.failed, false);

  const enforced = verdict(rows, { enforce: true });
  assert.match(enforced.lines[0], /^error: \/b loads 420 KB/);
  assert.match(enforced.lines[1], /^error: \/c is not in the build manifest/);
  assert.equal(enforced.failed, true);
});

test("within budget says nothing", () => {
  const rows = budgetRows(
    groups.map((g) => ({ ...g, routes: ["/a"] })),
    (r) => sizes[r],
  );
  assert.deepEqual(verdict(rows, { enforce: true }), { lines: [], failed: false });
});
