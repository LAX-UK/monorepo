import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { scan } from "./check-compositor-only.mjs";
import { compareWithAllowlist, findCompositorViolations } from "./compositor-rule.mjs";

const rules = (source, filename) =>
  findCompositorViolations(source, filename ? { filename } : {}).map((f) => f.rule);
const tsx = (source) => rules(source, "x.tsx");

test("flags transition: all, transition-property: all and Tailwind transition-all", () => {
  assert.deepEqual(rules(".a { transition: all 200ms ease; }"), ["transition-all"]);
  assert.deepEqual(rules(".a { transition-property: all; }"), ["transition-all"]);
  assert.deepEqual(tsx('<div className="p-2 hover:transition-all" />'), ["transition-all"]);
  assert.deepEqual(tsx('<div className="transition-[all]" />'), ["transition-all"]);
});

test("flags transitions of layout and paint properties", () => {
  assert.deepEqual(rules(".a { transition: width 200ms, opacity 100ms; }"), ["transition:width"]);
  assert.deepEqual(rules(".a { transition-property: transform, box-shadow; }"), [
    "transition:box-shadow",
  ]);
  assert.deepEqual(tsx('<div className="transition-[margin-left,opacity]" />'), [
    "transition:margin-left",
  ]);
  assert.deepEqual(tsx('<div className="transition-shadow" />'), ["transition:box-shadow"]);
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
  assert.deepEqual(tsx('<div className="transition-[transform,opacity] transition-colors" />'), []);
  assert.deepEqual(
    rules(".a { transition: line-height 1s, border-width 1s, stroke-width 1s; }"),
    [],
  );
  assert.deepEqual(rules("@keyframes fade { from { opacity: 0; transform: scale(0.98); } }"), []);
  assert.deepEqual(rules(".a { height: 10px; box-shadow: none; filter: none; }"), []);
});

test("reads a transition value wrapped across lines", () => {
  const css = `.zz {
  transition:
    opacity 1s,
    box-shadow 1s;
}`;
  assert.deepEqual(findCompositorViolations(css), [{ line: 2, rule: "transition:box-shadow" }]);
  assert.deepEqual(rules(".a {\n transition-property:\n  transform,\n  all;\n}"), [
    "transition-all",
  ]);
  assert.deepEqual(rules(".a {\n transition:\n  opacity 1s,\n  transform 1s;\n}"), []);
  assert.deepEqual(rules(".a{transition:opacity 1s,\n\n  margin-inline-start 1s}"), [
    "transition:margin-inline-start",
  ]);
});

test("reads shorthands, logical margins and vendor prefixes", () => {
  assert.deepEqual(rules(".a { transition: height 1s ease-in 0.1s, opacity 1s; }"), [
    "transition:height",
  ]);
  assert.deepEqual(rules(".a { transition: margin-block-end 1s; }"), [
    "transition:margin-block-end",
  ]);
  assert.deepEqual(rules(".a { transition: -webkit-backdrop-filter 1s; }"), [
    "transition:backdrop-filter",
  ]);
  assert.deepEqual(rules(".a { transition: all 1s, color 1s !important; }"), ["transition-all"]);
  assert.deepEqual(rules(".a { transition: margin-bottom-color 1s; }"), [
    "transition:margin-bottom-color",
  ]);
});

test("reads keyframes in full, including nested at-rules and vendor prefixes", () => {
  const css = `@keyframes a {
  from { opacity: 0; }
  50%, 75% {
    -webkit-backdrop-filter: blur(1px);
    margin-inline-start: 1px;
  }
}
@media (min-width: 1px) { @keyframes b { to { width: 1px; } } }
@keyframes ok { to { transform: none; line-height: 2; } }`;
  assert.deepEqual(rules(css), [
    "keyframes:backdrop-filter",
    "keyframes:margin-inline-start",
    "keyframes:width",
  ]);
  assert.deepEqual(
    rules(".a { width: 1px; animation: a 1s; } @keyframes ok { to { opacity: 1 } }"),
    [],
  );
});

test("flags Tailwind transition-all, bare transition and arbitrary transitions in classes", () => {
  assert.deepEqual(tsx('<div className="flex hover:transition-all duration-200" />'), [
    "transition-all",
  ]);
  assert.deepEqual(tsx('<div className={cn("rounded transition hover:shadow-lg")} />'), [
    "transition-bare",
  ]);
  assert.deepEqual(tsx("<div className={`p-2 md:hover:transition ${x}`} />"), ["transition-bare"]);
  assert.deepEqual(tsx('<div className="transition-[height,opacity]" />'), ["transition:height"]);
  assert.deepEqual(rules(".a { @apply transition-all duration-200; }", "a.css"), [
    "transition-all",
  ]);
  assert.deepEqual(
    tsx(
      '<div className="transition-colors transition-opacity transition-transform transition-none" />',
    ),
    [],
  );
});

test("does not mistake prose for the bare transition utility", () => {
  assert.deepEqual(tsx('const t = "a deliberate transition towards the new design";'), []);
  assert.deepEqual(tsx('const kind = "transition";'), []);
});

test("reads inline and template-literal styles, wrapped or not", () => {
  assert.deepEqual(tsx('<div style={{ transition: "all 1s" }} />'), ["transition-all"]);
  assert.deepEqual(tsx("<div style={{ transition: `opacity 1s,\n  height 1s` }} />"), [
    "transition:height",
  ]);
  assert.deepEqual(
    tsx("const css = `.a {\n  transition: border-color 1s,\n    box-shadow 1s;\n}`;"),
    ["transition:box-shadow"],
  );
  assert.deepEqual(tsx("@keyframes k { to { box-shadow: none; } }"), ["keyframes:box-shadow"]);
});

test("ignores comments", () => {
  assert.deepEqual(tsx("// transition-all and transition: all 1s\nconst a = 1;"), []);
  assert.deepEqual(tsx('const u = "https://example.com"; // transition-all'), []);
  assert.deepEqual(rules("/* transition:\n all 1s; */ .a { color: red; }"), []);
});

test("ignores comments (css)", () => {
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
