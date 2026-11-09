import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { findUndeclaredImports } from "./check-undeclared-imports.mjs";
import {
  importedModules,
  isTestFile,
  packageNameOf,
  undeclaredImportProblem,
} from "./undeclared-imports-rule.mjs";

const FIXTURE_ROOT = path.resolve(import.meta.dirname, "check-undeclared-imports.fixtures");

const manifest = {
  name: "@fixture/app",
  dependencies: { next: "1", "@auction/ui": "workspace:*" },
  devDependencies: { vitest: "1" },
  peerDependencies: { react: "19" },
};
const app = { manifest, isApp: true, isTest: false, aliasPatterns: ["@/*"] };

test("findUndeclaredImports fails an import the workspace does not declare", () => {
  const violations = findUndeclaredImports(FIXTURE_ROOT);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /apps\/demo\/src\/page\.tsx: "radix-ui" - radix-ui is not declared/);
});

test("packageNameOf keeps the scope and drops subpaths", () => {
  assert.equal(packageNameOf("@auction/ui/lax"), "@auction/ui");
  assert.equal(packageNameOf("next/image"), "next");
  assert.equal(packageNameOf("radix-ui"), "radix-ui");
});

test("undeclaredImportProblem allows declared, built-in, relative and aliased imports", () => {
  for (const specifier of [
    "next/image",
    "@auction/ui/lax",
    "react",
    "node:fs",
    "fs/promises",
    "path",
    "./local",
    "../up",
    "@/lib/thing",
    "@fixture/app/self",
  ]) {
    assert.equal(undeclaredImportProblem(specifier, app), null, specifier);
  }
});

test("undeclaredImportProblem rejects a package no field declares", () => {
  assert.match(undeclaredImportProblem("radix-ui", app) ?? "", /not declared/);
  assert.match(
    undeclaredImportProblem("@auction/queues", app) ?? "",
    /@auction\/queues is not declared/,
  );
});

test("undeclaredImportProblem keeps devDependencies out of app source but allows tests and types", () => {
  assert.match(undeclaredImportProblem("vitest", app) ?? "", /devDependency/);
  assert.equal(undeclaredImportProblem("vitest", { ...app, isTest: true }), null);
  assert.equal(undeclaredImportProblem("vitest", { ...app, typeOnly: true }), null);
  assert.equal(undeclaredImportProblem("vitest", { ...app, isApp: false }), null);
});

test("isTestFile covers tests and the support files only tests load", () => {
  for (const file of [
    "a/b.test.ts",
    "a/b.spec.tsx",
    "a/b.integration.test.ts",
    "test/setup.ts",
    "lib/testing/fake.ts",
    "a/b.mock.ts",
    "a/crm-test-doubles.ts",
    "a/x.test-helpers.ts",
  ]) {
    assert.equal(isTestFile(file), true, file);
  }
  for (const file of ["a/b.ts", "lib/latest/thing.ts", "a/contest.ts"]) {
    assert.equal(isTestFile(file), false, file);
  }
});

test("importedModules reads imports, re-exports, requires and dynamic imports, not strings", () => {
  const source = `
    import a from "a";
    import type { B } from "b";
    export * from "c";
    export type { D } from "d";
    const e = require("e");
    const f = await import("f");
    type G = import("g").H;
    const text = 'import x from "not-a-module"';
    // import y from "also-not"
  `;
  assert.deepEqual(importedModules("x.ts", source), [
    { specifier: "a", typeOnly: false },
    { specifier: "b", typeOnly: true },
    { specifier: "c", typeOnly: false },
    { specifier: "d", typeOnly: true },
    { specifier: "e", typeOnly: false },
    { specifier: "f", typeOnly: false },
    { specifier: "g", typeOnly: true },
  ]);
});
