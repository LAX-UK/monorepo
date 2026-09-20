#!/usr/bin/env node
/**
 * Fails when vi.mock targets for next/* or @auction/* never appear in the test file's
 * static import graph (transitive), which usually means the mock is dead after refactors.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { workspaceSourceAliases } from "./vitest/workspace-source-aliases.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_DEPTH = 48;

/** @type {Map<string, string>} */
const auctionAlias = new Map(
  workspaceSourceAliases(["@auction/ui", "@auction/marketing-ui"]).map((a) => [
    a.find,
    a.replacement,
  ]),
);

const APPS = [
  { name: "web", srcRoot: join(ROOT, "apps/web/src"), aliasPrefix: "@", enforceAliasMocks: false },
  {
    name: "shop",
    srcRoot: join(ROOT, "apps/shop/src"),
    aliasPrefix: "@",
    enforceAliasMocks: false,
  },
  {
    name: "shop-api",
    srcRoot: join(ROOT, "apps/shop-api/src"),
    aliasPrefix: "@",
    enforceAliasMocks: true,
  },
  {
    name: "shop-identity",
    srcRoot: join(ROOT, "apps/shop-identity/src"),
    aliasPrefix: "@",
    enforceAliasMocks: true,
  },
];

/** @param {string} dir */
function walkTestFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkTestFiles(full));
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/** @param {string} source */
function extractImportSpecifiers(source) {
  /** @type {string[]} */
  const specs = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }
  return specs;
}

/** @param {string} source */
/** @param {string} source */
function extractBarrelReexportSpecifiers(source) {
  /** @type {string[]} */
  const specs = [];
  for (const match of source.matchAll(/\bexport\s+\*\s+from\s+["']([^"']+)["']/g)) {
    specs.push(match[1]);
  }
  return specs;
}

function extractMockSpecifiers(source) {
  /** @type {string[]} */
  const specs = [];
  for (const match of source.matchAll(/vi\.mock\(\s*["']([^"']+)["']/g)) {
    specs.push(match[1]);
  }
  return specs;
}

/**
 * @param {string} spec
 * @param {string} fromFile
 * @param {string} srcRoot
 */
function stripJsExtension(spec) {
  return spec.endsWith(".js") ? spec.slice(0, -3) : spec;
}

function resolveModuleFile(spec, fromFile, srcRoot) {
  const normalized = stripJsExtension(spec);
  if (normalized.startsWith("@/")) {
    const candidate = join(srcRoot, normalized.slice(2));
    return resolveTypeScriptFile(candidate);
  }
  if (normalized.startsWith("@auction/")) {
    const aliasTarget = auctionAlias.get(normalized);
    if (aliasTarget) return aliasTarget;
    return null;
  }
  if (normalized.startsWith(".")) {
    const candidate = resolve(dirname(fromFile), normalized);
    return resolveTypeScriptFile(candidate);
  }
  return null;
}

/** @param {string} basePath without extension */
function resolveTypeScriptFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * @param {string} testFile
 * @param {string} srcRoot
 */
function collectReachableImports(testFile, srcRoot) {
  /** @type {Set<string>} */
  const importSpecs = new Set();
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {Array<{ file: string, depth: number }>} */
  const queue = [{ file: testFile, depth: 0 }];

  while (queue.length > 0) {
    const { file, depth } = queue.shift();
    if (visited.has(file) || depth > MAX_DEPTH) continue;
    visited.add(file);

    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const spec of extractImportSpecifiers(source)) {
      importSpecs.add(spec);
      const next = resolveModuleFile(spec, file, srcRoot);
      if (next && !visited.has(next)) {
        queue.push({ file: next, depth: depth + 1 });
      }
    }
    for (const spec of extractBarrelReexportSpecifiers(source)) {
      importSpecs.add(spec);
      const next = resolveModuleFile(spec, file, srcRoot);
      if (next && !visited.has(next)) {
        queue.push({ file: next, depth: depth + 1 });
      }
    }
  }

  return importSpecs;
}

/** @param {string} mockSpec @param {{ aliasPrefix?: string }} app */
function isEnforcedMock(mockSpec, app) {
  if (mockSpec.startsWith("next/") || mockSpec.startsWith("@auction/")) {
    return true;
  }
  return app.enforceAliasMocks && app.aliasPrefix
    ? mockSpec.startsWith(`${app.aliasPrefix}/`)
    : false;
}

/**
 * @param {string} testFile
 * @param {string} srcRoot
 * @returns {string[]}
 */
export function findDeadMocksForTestFile(testFile, srcRoot, app = { aliasPrefix: "@" }) {
  const source = readFileSync(testFile, "utf8");
  const mocks = extractMockSpecifiers(source).filter((mockSpec) => isEnforcedMock(mockSpec, app));
  if (mocks.length === 0) return [];

  const reachable = collectReachableImports(testFile, srcRoot);
  return mocks.filter((mockSpec) => !reachable.has(mockSpec));
}

/** @type {string[]} */
const violations = [];

for (const app of APPS) {
  for (const testFile of walkTestFiles(app.srcRoot)) {
    for (const mockSpec of findDeadMocksForTestFile(testFile, app.srcRoot, app)) {
      violations.push(`${testFile}: vi.mock("${mockSpec}") is not reachable from static imports`);
    }
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (violations.length > 0) {
    console.error("Dead vi.mock targets detected:\n");
    for (const line of violations) {
      console.error(`  - ${line.replace(`${ROOT}/`, "")}`);
    }
    process.exit(1);
  }

  console.log("check-test-mocks: OK");
}
