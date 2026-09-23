#!/usr/bin/env node
/**
 * Overlays monorepo Identity closure onto a lax-identity checkout and regenerates
 * root manifest + lockfile. Used before pushing scripts/identity/repo-split handoff.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_FILTER_PATHS, IDENTITY_PACKAGE_PATHS } from "../identity/closure.mjs";
import { prepareIdentityRootManifest } from "./prepare-identity-lockfile.mjs";

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const destination = process.argv[2];
if (!destination) {
  console.error("Usage: sync-lax-identity-closure-overlay.mjs <lax-identity-checkout>");
  process.exit(2);
}

const skip = new Set(["node_modules", "dist", ".turbo", "coverage", ".git"]);

for (const relativePath of IDENTITY_FILTER_PATHS) {
  const source = join(monorepoRoot, relativePath);
  const target = join(destination, relativePath);
  if (!existsSync(source)) continue;
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, {
    recursive: true,
    force: true,
    filter(path) {
      return !path.split(/[/\\]/).some((part) => skip.has(part));
    },
  });
}

copyFileSync(join(monorepoRoot, "package.json"), join(destination, "package.json"));
prepareIdentityRootManifest(join(destination, "package.json"), [...IDENTITY_PACKAGE_PATHS]);

const lockResult = spawnSync("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], {
  cwd: destination,
  stdio: "inherit",
});
if (lockResult.status !== 0) {
  process.exit(lockResult.status ?? 1);
}

console.log(`Identity closure overlaid onto ${destination}`);
