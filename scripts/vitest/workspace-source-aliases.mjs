import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @param {string} distOrSrcPath relative path from package.json (e.g. "./dist/index.js")
 * @param {string} packageDir absolute package root
 * @returns {string | null} absolute path to a source file, or null if not mappable
 */
function resolveSourceFile(packageDir, distOrSrcPath) {
  if (typeof distOrSrcPath !== "string") return null;
  if (distOrSrcPath.endsWith(".css")) return null;
  if (!distOrSrcPath.includes("/dist/") && !distOrSrcPath.startsWith("./dist/")) {
    return null;
  }

  const withoutJs = distOrSrcPath.replace(/^\.\//, "").replace(/\.js$/, "");
  const srcBase = withoutJs.replace(/^dist\//, "src/");
  const baseAbs = join(packageDir, srcBase);

  const candidates = [
    `${baseAbs}.tsx`,
    `${baseAbs}.ts`,
    join(baseAbs, "index.ts"),
    join(baseAbs, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} exportsField
 * @returns {Array<[string, string]>}
 */
function exportEntries(exportsField) {
  if (!exportsField || typeof exportsField !== "object") return [];
  /** @type {Array<[string, string]>} */
  const entries = [];
  for (const [key, value] of Object.entries(exportsField)) {
    if (key.startsWith("./") && key.endsWith(".css")) continue;
    let target = null;
    if (typeof value === "string") {
      target = value;
    } else if (
      value &&
      typeof value === "object" &&
      "default" in value &&
      typeof value.default === "string"
    ) {
      target = value.default;
    }
    if (target) entries.push([key, target]);
  }
  return entries;
}

/**
 * @param {string} packageName e.g. "@auction/ui"
 * @returns {string}
 */
function packageDirForName(packageName) {
  const short = packageName.replace(/^@auction\//, "");
  return join(REPO_ROOT, "packages", short);
}

/**
 * Build Vite resolve.alias entries so app Vitest runs load workspace UI packages from src.
 *
 * @param {string[]} packageNames
 * @returns {Array<{ find: string | RegExp, replacement: string }>}
 */
export function workspaceSourceAliases(packageNames) {
  /** @type {Array<{ find: string, replacement: string }>} */
  const aliases = [];

  for (const packageName of packageNames) {
    const packageDir = packageDirForName(packageName);
    const manifestPath = join(packageDir, "package.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`workspaceSourceAliases: missing package at ${packageDir}`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entries = exportEntries(manifest.exports);

    for (const [exportKey, distPath] of entries) {
      const sourceFile = resolveSourceFile(packageDir, distPath);
      if (!sourceFile) continue;

      const find = exportKey === "." ? packageName : `${packageName}${exportKey.slice(1)}`;

      aliases.push({ find, replacement: sourceFile });
    }
  }

  // Longest import paths first so Vite prefers specific subpath aliases.
  aliases.sort((a, b) => b.find.length - a.find.length);
  return aliases;
}
