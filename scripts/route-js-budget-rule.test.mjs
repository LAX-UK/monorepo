import assert from "node:assert/strict";
import { test } from "node:test";
import {
  auditApp,
  firstLoadFiles,
  groupOf,
  overBudgetTable,
  pageRoutes,
  suggestBudgetKb,
  summaryTable,
  verdict,
} from "./route-js-budget-rule.mjs";

// A fixture build: gzip sizes in KB per file, standing in for reading and compressing real chunks.
const KB_OF = {
  "static/chunks/main-app.js": 100,
  "static/chunks/framework.js": 50,
  "static/chunks/home.js": 40,
  "static/chunks/lot.js": 200,
  "static/chunks/pay.js": 20,
  "static/chunks/settings.js": 30,
};
const buildManifest = {
  rootMainFiles: ["static/chunks/main-app.js", "static/chunks/framework.js"],
};
const appManifest = {
  pages: {
    "/(marketing)/(home)/page": ["static/chunks/home.js", "static/css/home.css"],
    "/(marketing)/lot/[slug]/[id]/page": ["static/chunks/lot.js", "static/chunks/main-app.js"],
    "/(client)/purchases/pay/page": ["static/chunks/pay.js"],
    "/(client)/settings/page": ["static/chunks/settings.js"],
    "/admin/(platform)/staff/page": ["static/chunks/settings.js"],
    "/(marketing)/layout": ["static/chunks/home.js"],
    "/health/live/route": [],
  },
};
const appConfig = {
  fallback: "public",
  ignore: ["^/admin"],
  groups: {
    public: { budgetKb: 200, match: [] },
    lot: { budgetKb: 300, match: ["^/\\(marketing\\)/lot/"] },
    checkout: { budgetKb: 150, match: ["^/\\(client\\)/purchases/pay"] },
    account: { budgetKb: 170, match: ["^/\\(client\\)/"] },
  },
};
const audit = () =>
  auditApp({
    app: "apps/web",
    appConfig,
    appManifest,
    buildManifest,
    gzipKbOf: (file) => KB_OF[file],
  });

test("first load is the root files and the route's own scripts, once each, without styles", () => {
  assert.deepEqual(firstLoadFiles(appManifest, buildManifest, "/(marketing)/(home)/page"), [
    "static/chunks/main-app.js",
    "static/chunks/framework.js",
    "static/chunks/home.js",
  ]);
  assert.equal(firstLoadFiles(appManifest, buildManifest, "/nope/page"), null);
});

test("only page routes are audited", () => {
  assert.deepEqual(pageRoutes(appManifest), [
    "/(marketing)/(home)/page",
    "/(marketing)/lot/[slug]/[id]/page",
    "/(client)/purchases/pay/page",
    "/(client)/settings/page",
    "/admin/(platform)/staff/page",
  ]);
});

test("routes join the first matching group, else the fallback", () => {
  assert.equal(groupOf(appConfig, "/(marketing)/lot/[slug]/[id]/page"), "lot");
  assert.equal(groupOf(appConfig, "/(client)/purchases/pay/page"), "checkout");
  assert.equal(groupOf(appConfig, "/(client)/settings/page"), "account");
  assert.equal(groupOf(appConfig, "/(marketing)/(home)/page"), "public");
});

test("first-load size sums the shared and route files, and ignored routes are left out", () => {
  const rows = audit();
  assert.deepEqual(
    rows.map((row) => [row.route, row.group, row.gzipKb, row.budgetKb]),
    [
      ["/(client)/settings/page", "account", 180, 170],
      ["/(client)/purchases/pay/page", "checkout", 170, 150],
      ["/(marketing)/lot/[slug]/[id]/page", "lot", 350, 300],
      ["/(marketing)/(home)/page", "public", 190, 200],
    ],
  );
});

test("a budget suggestion is the largest route in the group plus 10%, rounded up", () => {
  assert.equal(suggestBudgetKb([{ gzipKb: 100 }, { gzipKb: 180.2 }]), 199);
});

test("over-budget routes are warning annotations and do not fail until enforce is on", () => {
  const rows = audit();
  const warned = verdict(rows, { enforce: false });
  assert.equal(warned.failed, false);
  assert.equal(warned.lines.length, 3);
  assert.match(
    warned.lines[0],
    /^::warning title=Route JS budget::apps\/web \/\(client\)\/settings\/page loads 180 KB of JavaScript \(gzip\); the account budget is 170 KB$/,
  );

  const enforced = verdict(rows, { enforce: true });
  assert.equal(enforced.failed, true);
  assert.match(enforced.lines[0], /^error: apps\/web \/\(client\)\/settings\/page loads 180 KB/);
});

test("a build within budget says nothing and passes under enforcement", () => {
  const rows = audit().filter((row) => row.gzipKb <= row.budgetKb);
  assert.deepEqual(verdict(rows, { enforce: true }), { lines: [], over: [], failed: false });
});

test("the tables show the group summary and the over-budget routes", () => {
  const rows = audit();
  assert.match(summaryTable(rows), /apps\/web\s+lot\s+1\s+350 KB\s+300 KB\s+1 over/);
  assert.match(summaryTable(rows), /apps\/web\s+public\s+1\s+190 KB\s+200 KB\s+ok/);
  const over = overBudgetTable(rows);
  assert.match(over, /lot\s+350 KB\s+300 KB\s+50 KB/);
  assert.doesNotMatch(over, /home/);
});

test("the checked-in config has a boolean enforce flag and a fallback group per app", async () => {
  const { readFileSync } = await import("node:fs");
  const config = JSON.parse(
    readFileSync(new URL("./route-js-budgets.json", import.meta.url), "utf8"),
  );
  assert.equal(typeof config.enforce, "boolean");
  for (const [app, appConfig] of Object.entries(config.apps)) {
    assert.ok(appConfig.groups[appConfig.fallback], `${app} fallback group exists`);
    for (const [name, group] of Object.entries(appConfig.groups)) {
      assert.ok(group.budgetKb > 0, `${app} ${name} has a budget`);
    }
  }
});
