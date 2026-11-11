import assert from "node:assert/strict";
import { test } from "node:test";
import { chunkModules, duplicateModules } from "./route-js-chunk-modules.mjs";
import { ancestorPaths, frameKeys, startupSet } from "./route-js-startup-set.mjs";

const buildManifest = { rootMainFiles: ["webpack.js", "main-app.js"] };
const appManifest = {
  pages: {
    "/layout": ["root-layout.js", "shared.js", "style.css"],
    "/error": ["error.js"],
    "/not-found": ["not-found.js"],
    "/global-error": ["global-error.js"],
    "/(marketing)/layout": ["marketing-layout.js"],
    "/(marketing)/sales/[slug]/[id]/layout": ["sale-layout.js"],
    "/(marketing)/sales/[slug]/[id]/loading": ["sale-loading.js"],
    "/(marketing)/sales/[slug]/[id]/page": ["sale-page.js", "shared.js"],
    "/(client)/layout": ["client-layout.js"],
  },
};

test("a route's ancestors run from the root down to its own folder", () => {
  assert.deepEqual(ancestorPaths("/(marketing)/sales/[slug]/page"), [
    "",
    "/(marketing)",
    "/(marketing)/sales",
    "/(marketing)/sales/[slug]",
  ]);
  assert.deepEqual(ancestorPaths("/page"), [""]);
});

test("the frame of a route is every ancestor's layout and boundaries plus the root fallbacks", () => {
  const keys = frameKeys("/(marketing)/page");
  assert.ok(keys.includes("/layout"));
  assert.ok(keys.includes("/(marketing)/error"));
  assert.ok(keys.includes("/global-error"));
  assert.ok(keys.includes("/not-found"));
  assert.ok(!keys.includes("/(client)/layout"));
});

test("the start-up set is root files, ancestors and the page, scripts only, each file once", () => {
  const set = startupSet(appManifest, buildManifest, "/(marketing)/sales/[slug]/[id]/page");
  assert.deepEqual(set.frame.sort(), [
    "error.js",
    "global-error.js",
    "main-app.js",
    "marketing-layout.js",
    "not-found.js",
    "root-layout.js",
    "sale-layout.js",
    "sale-loading.js",
    "shared.js",
    "webpack.js",
  ]);
  assert.deepEqual(set.page, ["sale-page.js"]);
});

test("a route outside the manifest has no start-up set", () => {
  assert.equal(startupSet(appManifest, buildManifest, "/nope/page"), null);
});

test("chunk modules are read from the webpack push without running the modules", () => {
  const code =
    '(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1],{101:function(e){throw new Error("never")},202:function(e,t){return 1}}]);';
  assert.deepEqual([...chunkModules(code).keys()], ["101", "202"]);
  assert.equal(chunkModules("window.document.x()").size, 0);
});

test("the same module id in two chunks is one duplicate weighted by its chunk's gzip ratio", () => {
  const chunks = {
    a: { gzipKb: 10, rawBytes: 1000, modules: new Map([["1", 500]]) },
    b: {
      gzipKb: 5,
      rawBytes: 1000,
      modules: new Map([
        ["1", 200],
        ["2", 100],
      ]),
    },
  };
  assert.deepEqual(duplicateModules(chunks), { count: 1, kb: 1 });
});
