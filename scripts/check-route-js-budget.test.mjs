import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { main, parseArgs } from "./check-route-js-budget.mjs";

// A build in the shape Next 15 writes: `app-build-manifest.json` keys every route by its `/page`
// (or `/layout`, `/global-error`) entry, `build-manifest.json` lists the root main files, and the
// chunks are real files whose gzip size is what the script measures.
const APP_MANIFEST = {
  pages: {
    "/_not-found/page": ["static/chunks/webpack-aaa.js", "static/chunks/main-app-bbb.js"],
    "/global-error": ["static/chunks/webpack-aaa.js", "static/chunks/main-app-bbb.js"],
    "/layout": [
      "static/chunks/webpack-aaa.js",
      "static/chunks/app/layout-fff.js",
      "static/css/app/layout.css",
    ],
    "/(marketing)/page": [
      "static/chunks/webpack-aaa.js",
      "static/chunks/main-app-bbb.js",
      "static/chunks/app/(marketing)/page-ccc.js",
      "static/css/app/(marketing)/page.css",
    ],
    "/admin/staff/page": ["static/chunks/app/admin/staff/page-ddd.js"],
  },
};
const BUILD_MANIFEST = {
  polyfillFiles: ["static/chunks/polyfills-eee.js"],
  rootMainFiles: ["static/chunks/webpack-aaa.js", "static/chunks/main-app-bbb.js"],
  pages: { "/_app": [], "/_error": [] },
  lowPriorityFiles: [],
};

// Pseudo-random text, so each chunk has a stable, non-trivial gzip size.
const chunk = (bytes) => {
  let seed = 7;
  let out = "";
  while (out.length < bytes) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out += seed.toString(36);
  }
  return out.slice(0, bytes);
};

let root;
let configPath;
const logs = [];
const log = (line) => logs.push(line);
let baselinePath;
const run = (argv, env = {}) => {
  logs.length = 0;
  return main(argv, { root, configPath, baselinePath, env, log });
};
const writeBaseline = (gzipKb) =>
  writeFileSync(
    baselinePath,
    JSON.stringify({
      measuredWith: "test",
      toleranceKb: 1,
      routes: {
        "apps/built /(marketing)/page": { label: "Home", targetKb: 5, gzipKb },
        "apps/unbuilt /(marketing)/page": { label: "Elsewhere", targetKb: 5, gzipKb: 1 },
      },
    }),
  );
const writeConfig = (config) => writeFileSync(configPath, JSON.stringify(config));
const config = (enforce, budgetKb, extra = {}) => ({
  enforce,
  apps: {
    "apps/built": {
      ...extra,
      fallback: "public",
      ignore: ["^/admin"],
      groups: { public: { budgetKb, match: [] } },
    },
    "apps/unbuilt": { fallback: "public", ignore: [], groups: { public: { budgetKb, match: [] } } },
  },
});

before(() => {
  root = mkdtempSync(path.join(tmpdir(), "route-js-budget-"));
  configPath = path.join(root, "route-js-budgets.json");
  baselinePath = path.join(root, "route-js-baseline.json");
  const next = path.join(root, "apps/built/.next");
  mkdirSync(path.join(next, "static/chunks/app/(marketing)"), { recursive: true });
  writeFileSync(path.join(next, "app-build-manifest.json"), JSON.stringify(APP_MANIFEST));
  writeFileSync(path.join(next, "build-manifest.json"), JSON.stringify(BUILD_MANIFEST));
  writeFileSync(path.join(next, "static/chunks/webpack-aaa.js"), chunk(2048));
  writeFileSync(path.join(next, "static/chunks/main-app-bbb.js"), chunk(10240));
  writeFileSync(path.join(next, "static/chunks/app/(marketing)/page-ccc.js"), chunk(5120));
  writeFileSync(path.join(next, "static/chunks/app/layout-fff.js"), chunk(3072));
});

after(() => rmSync(root, { recursive: true, force: true }));

test("a route is measured from a Next 15 manifest: root files, layouts and its own, no styles", () => {
  writeConfig(config(false, 100));
  assert.equal(run(["--all"]), 0);
  // Frame: webpack, main-app and the root layout chunk; page: the route's own chunk.
  assert.match(
    logs.join("\n"),
    /apps\/built\s+public\s+\d+\.\d KB\s+\d+\.\d KB\s+[1-9]\d*\.\d KB\s+0 \(0\.0 KB\)\s+4\s+100 KB\s+\/\(marketing\)\/page/,
  );
  assert.doesNotMatch(logs.join("\n"), /admin|global-error|layout/);
});

test("an app without a build is skipped with a notice and does not fail", () => {
  writeConfig(config(true, 100));
  assert.equal(run(["--app", "apps/unbuilt"]), 0);
  assert.match(
    logs[0],
    /^::notice title=Route JS budget::apps\/unbuilt has no production build; skipped$/,
  );
  assert.equal(logs[1], "No production builds found; nothing to audit.");
});

test("exit codes: 0 within budget, 0 on warnings, 1 when enforced, 2 for bad usage", () => {
  writeConfig(config(false, 100));
  assert.equal(run([]), 0);
  assert.doesNotMatch(logs.join("\n"), /::warning/);

  writeConfig(config(false, 5));
  assert.equal(run([]), 0);
  assert.match(logs.join("\n"), /::warning title=Route JS budget::/);

  writeConfig(config(true, 5));
  assert.equal(run([]), 1);
  assert.match(logs.join("\n"), /^error: apps\/built \/\(marketing\)\/page loads \d+\.\d KB/m);

  assert.equal(run(["--app", "apps/missing"]), 2);
  assert.equal(run(["--app"]), 2);
  assert.equal(run(["--bogus"]), 2);
});

test("--enforce and BUDGET_ENFORCE=1 enforce even when the config only warns", () => {
  writeConfig(config(false, 5));
  assert.equal(run(["--enforce"]), 1);
  assert.equal(run([], { BUDGET_ENFORCE: "1" }), 1);
  assert.equal(run([], { BUDGET_ENFORCE: "0" }), 0);
});

test("a group with enforce: true fails while other groups only warn", () => {
  const strict = config(false, 5);
  strict.apps["apps/built"].groups.public.enforce = true;
  writeConfig(strict);
  assert.equal(run([]), 1);
  assert.match(logs.join("\n"), /^error: /m);
});

test("an app that needs Sentry is refused when its build has no inlined DSN", () => {
  writeConfig(config(false, 100, { requireSentry: true }));
  assert.equal(run([]), 2);
  assert.equal(run(["--allow-no-sentry"]), 0);

  const mainApp = path.join(root, "apps/built/.next/static/chunks/main-app-bbb.js");
  const original = readFileSync(mainApp);
  writeFileSync(mainApp, `${original}\nSentry.init({dsn:"https://abc123@sentry.invalid/1"});`);
  try {
    assert.equal(run([]), 0);
  } finally {
    writeFileSync(mainApp, original);
  }
});

test("--suggest prints each group's largest route plus 10% and never fails", () => {
  writeConfig(config(true, 5));
  assert.equal(run(["--suggest"]), 0);
  assert.match(logs.join("\n"), /^apps\/built public: \d+ KB$/m);
});

test("--app refuses a missing value, including when another option follows", () => {
  assert.throws(() => parseArgs(["--app"]));
  assert.throws(() => parseArgs(["--app", "--all"]));
  assert.deepEqual(parseArgs(["--app", "apps/web", "--all", "--enforce"]), {
    apps: ["apps/web"],
    all: true,
    suggest: false,
    enforce: true,
    writeBaseline: false,
    allowNoSentry: false,
  });
  assert.equal(parseArgs(["--allow-no-sentry"]).allowNoSentry, true);
});

test("a tracked route over its ratchet fails even in a group that only warns", () => {
  writeConfig(config(false, 100));
  writeBaseline(1);
  assert.equal(run(["--app", "apps/built"]), 1);
  assert.match(logs.join("\n"), /^error: Home \(apps\/built .* over its ratchet of 1\.0 KB/m);
  assert.match(logs.join("\n"), /Tracked routes against their ratchet and target/);
});

test("a tracked route within its ratchet passes; routes of unbuilt apps are not judged", () => {
  writeConfig(config(false, 100));
  writeBaseline(100);
  assert.equal(run(["--app", "apps/built"]), 0);
});

test("--write-baseline records the measured size and keeps label and target", () => {
  writeConfig(config(false, 100));
  writeBaseline(1);
  assert.equal(run(["--app", "apps/built", "--write-baseline"]), 0);
  const entry = JSON.parse(readFileSync(baselinePath, "utf8")).routes[
    "apps/built /(marketing)/page"
  ];
  assert.equal(entry.label, "Home");
  assert.equal(entry.targetKb, 5);
  assert.ok(entry.gzipKb > 1 && entry.parsedKb > entry.gzipKb);
});
