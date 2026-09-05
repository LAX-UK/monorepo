#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function removeRootImporterFromLockfile(lockfilePath) {
  const lockfile = readFileSync(lockfilePath, "utf8");
  const withoutRootImporter = lockfile.replace(
    /^ {2}\.:\n[\s\S]*?(?=^ {2}(?:apps|packages)\/[^:\n]+:\n)/m,
    "  .: {}\n\n",
  );
  if (withoutRootImporter === lockfile) {
    throw new Error("Could not isolate the root importer in pnpm-lock.yaml");
  }
  writeFileSync(lockfilePath, withoutRootImporter);
}

export function prepareIdentityRootManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const identityManifest = {
    name: `${manifest.name ?? "workspace"}-identity`,
    private: true,
    ...(manifest.packageManager ? { packageManager: manifest.packageManager } : {}),
    ...(manifest.engines ? { engines: manifest.engines } : {}),
    ...(manifest.pnpm ? { pnpm: manifest.pnpm } : {}),
  };
  writeFileSync(manifestPath, `${JSON.stringify(identityManifest, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  removeRootImporterFromLockfile(resolve(process.argv[2] ?? "pnpm-lock.yaml"));
  if (process.argv[3]) prepareIdentityRootManifest(resolve(process.argv[3]));
}
