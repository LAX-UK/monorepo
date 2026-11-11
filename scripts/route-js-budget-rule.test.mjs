import assert from "node:assert/strict";
import { test } from "node:test";
import {
  auditApp,
  fullTable,
  groupOf,
  overBudgetTable,
  pageRoutes,
  routePath,
  suggestBudgetKb,
  summaryTable,
  verdict,
} from "./route-js-budget-rule.mjs";

// A fixture build: gzip sizes in KB per file, standing in for reading and compressing real chunks.
const KB_OF = {
  "static/chunks/layout.js": 10,
  "static/chunks/marketing-layout.js": 20,
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
    "/layout": ["static/chunks/layout.js"],
    "/(marketing)/layout": ["static/chunks/marketing-layout.js"],
    "/(marketing)/(home)/page": ["static/chunks/home.js", "static/css/home.css"],
    "/(marketing)/lot/[slug]/[id]/page": ["static/chunks/lot.js", "static/chunks/main-app.js"],
    "/(client)/purchases/pay/page": ["static/chunks/pay.js"],
    "/(client)/settings/page": ["static/chunks/settings.js"],
    "/admin/(platform)/staff/page": ["static/chunks/settings.js"],
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
    chunkOf: (file) => ({ gzipKb: KB_OF[file], rawBytes: KB_OF[file] * 4, modules: new Map() }),
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

test("a route's path is its key without the /page suffix", () => {
  assert.equal(routePath("/(marketing)/lot/[slug]/[id]/page"), "/(marketing)/lot/[slug]/[id]");
  assert.equal(routePath("/page"), "/");
});

test("verdict messages show one decimal place", () => {
  const rows = [
    { app: "apps/web", route: "/x/page", group: "public", gzipKb: 200.46, budgetKb: 200 },
  ];
  assert.match(verdict(rows, { enforce: true }).lines[0], /loads 200\.5 KB of JavaScript/);
});

test("routes join the first matching group, else the fallback", () => {
  assert.equal(groupOf(appConfig, "/(marketing)/lot/[slug]/[id]/page"), "lot");
  assert.equal(groupOf(appConfig, "/(client)/purchases/pay/page"), "checkout");
  assert.equal(groupOf(appConfig, "/(client)/settings/page"), "account");
  assert.equal(groupOf(appConfig, "/(marketing)/(home)/page"), "public");
});

test("start-up size sums the frame and the page's own files; ignored routes are left out", () => {
  const rows = audit();
  assert.deepEqual(
    rows.map((row) => [row.route, row.group, row.gzipKb, row.frameKb, row.pageKb, row.budgetKb]),
    [
      ["/(client)/settings/page", "account", 190, 160, 30, 170],
      ["/(client)/purchases/pay/page", "checkout", 180, 160, 20, 150],
      ["/(marketing)/lot/[slug]/[id]/page", "lot", 380, 180, 200, 300],
      ["/(marketing)/(home)/page", "public", 220, 180, 40, 200],
    ],
  );
});

test("a group's own enforce setting wins over the default", () => {
  const configured = {
    ...appConfig,
    groups: { ...appConfig.groups, lot: { ...appConfig.groups.lot, enforce: true } },
  };
  const rows = auditApp({
    app: "apps/web",
    appConfig: configured,
    appManifest,
    buildManifest,
    chunkOf: (file) => ({ gzipKb: KB_OF[file], rawBytes: 1, modules: new Map() }),
  });
  assert.deepEqual(
    rows.map((row) => [row.group, row.enforce]),
    [
      ["account", false],
      ["checkout", false],
      ["lot", true],
      ["public", false],
    ],
  );
  const v = verdict(rows.filter((row) => row.group !== "lot"));
  assert.equal(v.failed, false);
  assert.equal(verdict(rows).failed, true);
});

test("modules shipped in two start-up files are counted as duplicates with their weight", () => {
  const modules = (ids) => new Map(ids.map((id) => [id, 100]));
  const chunks = {
    "static/chunks/main-app.js": { gzipKb: 10, rawBytes: 1000, modules: modules(["a", "b"]) },
    "static/chunks/framework.js": { gzipKb: 10, rawBytes: 1000, modules: modules(["b", "c"]) },
    "static/chunks/layout.js": { gzipKb: 10, rawBytes: 1000, modules: modules([]) },
    "static/chunks/marketing-layout.js": { gzipKb: 10, rawBytes: 1000, modules: modules([]) },
    "static/chunks/home.js": { gzipKb: 10, rawBytes: 1000, modules: modules(["c", "d"]) },
  };
  const [home] = auditApp({
    app: "apps/web",
    appConfig: { ...appConfig, ignore: ["^/admin", "^/\\(client\\)", "lot"] },
    appManifest,
    buildManifest,
    chunkOf: (file) => chunks[file],
  });
  assert.equal(home.route, "/(marketing)/(home)/page");
  assert.equal(home.duplicateCount, 2);
  assert.equal(home.duplicateKb, 2);
});

test("a budget suggestion is the largest route in the group plus 10%, rounded up", () => {
  assert.equal(suggestBudgetKb([{ gzipKb: 100 }, { gzipKb: 180.2 }]), 199);
});

test("over-budget routes are warning annotations and do not fail until enforce is on", () => {
  const rows = audit();
  const warned = verdict(rows, { enforce: false });
  assert.equal(warned.failed, false);
  assert.equal(warned.lines.length, 4);
  assert.match(
    warned.lines[0],
    /^::warning title=Route JS budget::apps\/web \/\(client\)\/settings\/page loads 190.0 KB of JavaScript \(gzip\); the account budget is 170 KB$/,
  );

  const enforced = verdict(rows, { enforce: true });
  assert.equal(enforced.failed, true);
  assert.match(enforced.lines[0], /^error: apps\/web \/\(client\)\/settings\/page loads 190.0 KB/);
});

test("a build within budget says nothing and passes under enforcement", () => {
  const rows = audit().filter((row) => row.gzipKb <= row.budgetKb);
  assert.deepEqual(verdict(rows, { enforce: true }), { lines: [], over: [], failed: false });
});

test("the tables show the group summary and the over-budget routes", () => {
  const rows = audit();
  assert.match(
    summaryTable(rows),
    /apps\/web\s+lot\s+1\s+380.0 KB\s+180.0 KB\s+200.0 KB\s+0 \(0.0 KB\)\s+300 KB\s+warn\s+1 over/,
  );
  assert.match(summaryTable(rows), /apps\/web\s+public\s+1\s+220.0 KB\s+.*200 KB\s+warn\s+1 over/);
  assert.match(fullTable(rows), /lot\s+380.0 KB\s+180.0 KB\s+200.0 KB/);
  const over = overBudgetTable(rows);
  assert.match(over, /lot\s+380.0 KB\s+300 KB\s+80.0 KB/);
  assert.ok(over.indexOf("lot") < over.indexOf("public"), "largest overshoot first");
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

test("Shop guest order pages belong to the account group", async () => {
  const { readFileSync } = await import("node:fs");
  const config = JSON.parse(
    readFileSync(new URL("./route-js-budgets.json", import.meta.url), "utf8"),
  );
  const shop = config.apps["apps/shop"];
  assert.equal(groupOf(shop, "/orders/guest/page"), "account");
  assert.equal(groupOf(shop, "/orders/guest/report-a-problem/page"), "account");
  assert.equal(groupOf(shop, "/account/orders/page"), "account");
});
