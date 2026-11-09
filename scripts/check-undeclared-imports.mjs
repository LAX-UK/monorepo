#!/usr/bin/env node
/**
 * Undeclared-import guard: every bare import in apps/*\/src and packages/*\/src must resolve to a
 * package the workspace lists in its own package.json. Hoisting hides a missing declaration in the
 * monorepo; the Docker build, which installs one app's dependencies only, then fails. The rule
 * itself lives in undeclared-imports-rule.mjs.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { listSourceFiles } from "./identity/import-specifiers.mjs";
import {
  importedModules,
  isTestFile,
  undeclaredImportProblem,
} from "./undeclared-imports-rule.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const WORKSPACE_ROOTS = ["apps", "packages"];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Workspace directories that have a package.json and a src folder. */
function listWorkspaces(root) {
  return WORKSPACE_ROOTS.filter((group) => existsSync(path.join(root, group))).flatMap((group) =>
    readdirSync(path.join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ group, dir: path.join(root, group, entry.name) }))
      .filter(
        ({ dir }) =>
          existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "src")),
      ),
  );
}

/** tsconfig `paths` keys, e.g. `@/*`, which resolve inside the workspace and need no package. */
function readAliasPatterns(dir) {
  const tsconfig = path.join(dir, "tsconfig.json");
  if (!existsSync(tsconfig)) return [];
  const { config } = ts.readConfigFile(tsconfig, ts.sys.readFile);
  return Object.keys(config?.compilerOptions?.paths ?? {});
}

export function findUndeclaredImports(root = ROOT) {
  const violations = [];
  for (const { group, dir } of listWorkspaces(root)) {
    const context = {
      manifest: readJson(path.join(dir, "package.json")),
      isApp: group === "apps",
      aliasPatterns: readAliasPatterns(dir),
    };
    for (const file of listSourceFiles(path.join(dir, "src"))) {
      const relative = path.relative(dir, file).split(path.sep).join("/");
      const isTest = isTestFile(relative);
      for (const { specifier, typeOnly } of importedModules(file, readFileSync(file, "utf8"))) {
        const problem = undeclaredImportProblem(specifier, { ...context, isTest, typeOnly });
        if (problem) violations.push(`${path.relative(root, file)}: "${specifier}" - ${problem}`);
      }
    }
  }
  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = findUndeclaredImports();
  if (violations.length > 0) {
    console.error("Imports not declared in the importing workspace's package.json:\n");
    for (const violation of violations) console.error(`  ${violation}`);
    console.error(
      "\nDeclare the package in that workspace's package.json (same range as elsewhere).",
    );
    process.exit(1);
  }
  console.log("Undeclared-import check passed.");
}
