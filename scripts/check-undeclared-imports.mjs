#!/usr/bin/env node
/**
 * Undeclared-import guard: every bare import in apps/*\/src, packages/*\/src and the top-level
 * entry files an app ships (instrumentation, Sentry and Next configs, .mjs scripts) must resolve to
 * a package the workspace lists in its own package.json. Hoisting hides a missing declaration in the
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
/** Files at a workspace root that ship with it. Tool configs (vitest, playwright, ...) do not. */
const ENTRY_FILE_RE =
  /^(?:instrumentation[\w.-]*\.ts|sentry\.[\w.-]+\.config\.ts|next\.config\.ts|[\w.-]+\.mjs)$/;
const TOOL_CONFIG_RE = /^(?:vitest|playwright|eslint|postcss|tailwind)[\w.-]*\.(?:ts|mjs)$/;

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Workspace directories that have a package.json and a src folder. */
function listWorkspaces(root) {
  return WORKSPACE_ROOTS.filter((group) => existsSync(path.join(root, group))).flatMap((group) =>
    readdirSync(path.join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ dir: path.join(root, group, entry.name) }))
      .filter(
        ({ dir }) =>
          existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "src")),
      ),
  );
}

/** The shipped entry files that sit next to a workspace's package.json. */
function listEntryFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && ENTRY_FILE_RE.test(entry.name) && !TOOL_CONFIG_RE.test(entry.name),
    )
    .map((entry) => path.join(dir, entry.name));
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
  for (const { dir } of listWorkspaces(root)) {
    const context = {
      manifest: readJson(path.join(dir, "package.json")),
      aliasPatterns: readAliasPatterns(dir),
    };
    const files = [...listSourceFiles(path.join(dir, "src")), ...listEntryFiles(dir)];
    for (const file of files) {
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
