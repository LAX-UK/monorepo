import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { scan } from "./check-compositor-only.mjs";
import { compareWithAllowlist, findCompositorViolations } from "./compositor-rule.mjs";

const rules = (source) => findCompositorViolations(source).map((f) => f.rule);

test("flags transition: all, transition-property: all and Tailwind transition-all", () => {
  assert.deepEqual(rules(".a { transition: all 200ms ease; }"), ["transition-all"]);
  assert.deepEqual(rules(".a { transition-property: all; }"), ["transition-all"]);
  assert.deepEqual(rules('<div className="p-2 hover:transition-all" />'), ["transition-all"]);
  assert.deepEqual(rules('<div className="transition-[all]" />'), ["transition-all"]);
});

test("flags transitions of layout and paint properties", () => {
  assert.deepEqual(rules(".a { transition: width 200ms, opacity 100ms; }"), ["transition:width"]);
  assert.deepEqual(rules(".a { transition-property: transform, box-shadow; }"), [
    "transition:box-shadow",
  ]);
  assert.deepEqual(rules('<div className="transition-[margin-left,opacity]" />'), [
    "transition:margin-left",
  ]);
  assert.deepEqual(rules('<div className="transition-shadow" />'), ["transition:box-shadow"]);
  assert.deepEqual(rules(".a { transition: backdrop-filter 1s; }"), ["transition:backdrop-filter"]);
});

test("flags keyframes that set a banned property, once per property", () => {
  const css = "@keyframes grow { from { height: 0; } to { height: 10px; top: 1px; } }";
  assert.deepEqual(rules(css), ["keyframes:height", "keyframes:top"]);
});

test("accepts transform, opacity, colour and similar names", () => {
  assert.deepEqual(
    rules(".a { transition: transform 100ms, opacity 100ms, background-color 1s; }"),
    [],
  );
  assert.deepEqual(
    rules('<div className="transition-[transform,opacity] transition-colors" />'),
    [],
  );
  assert.deepEqual(
    rules(".a { transition: line-height 1s, border-width 1s, stroke-width 1s; }"),
    [],
  );
  assert.deepEqual(rules("@keyframes fade { from { opacity: 0; transform: scale(0.98); } }"), []);
  assert.deepEqual(rules(".a { height: 10px; box-shadow: none; filter: none; }"), []);
});

test("ignores comments", () => {
  assert.deepEqual(rules("/* transition: all 1s; */ .a { color: red; }"), []);
});

test("reports line numbers", () => {
  assert.deepEqual(findCompositorViolations("a\n\n.b { transition: all 1s; }"), [
    { line: 3, rule: "transition-all" },
  ]);
});

test("the allowlist admits listed offenders but not new or extra ones, and never goes stale", () => {
  const found = new Map([["a.css", [{ line: 1, rule: "transition-all" }]]]);
  assert.deepEqual(
    compareWithAllowlist(found, [{ file: "a.css", rule: "transition-all", count: 1 }]),
    [],
  );
  assert.equal(compareWithAllowlist(found, []).length, 1);
  assert.equal(
    compareWithAllowlist(found, [{ file: "a.css", rule: "transition-all", count: 2 }]).length,
    1,
  );
  assert.equal(
    compareWithAllowlist(new Map(), [{ file: "a.css", rule: "transition-all", count: 1 }]).length,
    1,
  );
});

test("the repository matches its allowlist", () => {
  const { entries } = JSON.parse(
    readFileSync(fileURLToPath(new URL("./compositor-allowlist.json", import.meta.url)), "utf8"),
  );
  assert.deepEqual(compareWithAllowlist(scan(), entries), []);
});
