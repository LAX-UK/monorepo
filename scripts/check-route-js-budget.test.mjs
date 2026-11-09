import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    "/layout": ["static/chunks/webpack-aaa.js", "static/css/app/layout.css"],
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
const run = (argv, env = {}) => {
  logs.length = 0;
  return main(argv, { root, configPath, env, log });
};
const writeConfig = (config) => writeFileSync(configPath, JSON.stringify(config));
const config = (enforce, budgetKb) => ({
  enforce,
  apps: {
    "apps/built": {
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
  const next = path.join(root, "apps/built/.next");
  mkdirSync(path.join(next, "static/chunks/app/(marketing)"), { recursive: true });
  writeFileSync(path.join(next, "app-build-manifest.json"), JSON.stringify(APP_MANIFEST));
  writeFileSync(path.join(next, "build-manifest.json"), JSON.stringify(BUILD_MANIFEST));
  writeFileSync(path.join(next, "static/chunks/webpack-aaa.js"), chunk(2048));
  writeFileSync(path.join(next, "static/chunks/main-app-bbb.js"), chunk(10240));
  writeFileSync(path.join(next, "static/chunks/app/(marketing)/page-ccc.js"), chunk(5120));
});

after(() => rmSync(root, { recursive: true, force: true }));

test("the home route is measured from a Next 15 manifest: root files plus its own, no styles", () => {
  writeConfig(config(false, 100));
  assert.equal(run(["--all"]), 0);
  assert.match(
    logs.join("\n"),
    /apps\/built\s+public\s+\d+\.\d KB\s+100 KB\s+\/\(marketing\)\/page/,
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
  });
});
