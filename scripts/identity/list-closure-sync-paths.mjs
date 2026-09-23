/**
 * Relative paths compared between monorepo Identity closure and lax-identity.
 * Excludes regenerated lockfiles; root workspace files use prepareIdentityRootManifest.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  IDENTITY_DOCKER,
  IDENTITY_PACKAGE_PATHS,
  IDENTITY_ROOT_FILES,
  IDENTITY_SCRIPT_FILES,
} from "./closure.mjs";

const SKIP_DIRECTORIES = new Set([".git", ".turbo", "coverage", "dist", "node_modules"]);

const ROOT_FILE_SYNC = new Set(
  IDENTITY_ROOT_FILES.filter(
    (entry) =>
      entry !== "pnpm-lock.yaml" &&
      entry !== "package.json" &&
      entry !== "pnpm-workspace.yaml" &&
      entry !== ".npmrc" &&
      entry !== "biome.json",
  ),
);

export const IDENTITY_ROOT_MANIFEST_FILES = Object.freeze([
  "package.json",
  "pnpm-workspace.yaml",
  ".npmrc",
  "biome.json",
]);

function walkFiles(repoRoot, relativeDir, acc) {
  const absoluteDir = join(repoRoot, relativeDir);
  let entries;
  try {
    entries = readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const absolutePath = join(repoRoot, relativePath);
    if (entry.isDirectory()) {
      walkFiles(repoRoot, relativePath, acc);
    } else if (statSync(absolutePath).isFile()) {
      acc.push(relativePath);
    }
  }
}

/**
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function listClosureSyncRelativePaths(repoRoot) {
  /** @type {string[]} */
  const paths = [];

  for (const packagePath of IDENTITY_PACKAGE_PATHS) {
    walkFiles(repoRoot, packagePath, paths);
  }

  for (const entry of ROOT_FILE_SYNC) {
    const absolutePath = join(repoRoot, entry);
    try {
      if (statSync(absolutePath).isDirectory()) {
        walkFiles(repoRoot, entry, paths);
      } else {
        paths.push(entry);
      }
    } catch {
      paths.push(entry);
    }
  }

  paths.push(IDENTITY_DOCKER.dockerfile);

  for (const scriptPath of IDENTITY_SCRIPT_FILES) {
    const absolutePath = join(repoRoot, scriptPath);
    try {
      if (statSync(absolutePath).isDirectory()) {
        walkFiles(repoRoot, scriptPath, paths);
      } else {
        paths.push(scriptPath);
      }
    } catch {
      paths.push(scriptPath);
    }
  }

  return [...new Set(paths)].sort();
}
