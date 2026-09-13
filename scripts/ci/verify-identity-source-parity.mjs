#!/usr/bin/env node
/**
 * Verifies shared Identity closure sources match between monorepo and standalone
 * lax-identity for runtime-critical paths. Packaging-only differences are allowed
 * when documented in apps/auth/Dockerfile.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_PACKAGE_PATHS } from "../identity/closure.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const standaloneRoot = process.env.LAX_IDENTITY_ROOT;
const runtimePaths = [
  "apps/auth/src/container/create-auth-schedules.ts",
  "apps/auth/src/index.ts",
  "apps/auth/src/services/ssf-stream.service.ts",
  "packages/identity-db/src/auth-at-rest.ts",
  "scripts/ci/verify-identity-ssf-live.mjs",
];

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function main() {
  if (!standaloneRoot) {
    console.log("LAX_IDENTITY_ROOT not set; skipping standalone source parity check.");
    return;
  }

  const violations = [];
  for (const relativePath of runtimePaths) {
    const monorepoPath = join(repoRoot, relativePath);
    const standalonePath = join(standaloneRoot, relativePath);
    try {
      if (hashFile(monorepoPath) !== hashFile(standalonePath)) {
        violations.push(relativePath);
      }
    } catch {
      violations.push(`${relativePath} (missing in one repository)`);
    }
  }

  for (const packagePath of IDENTITY_PACKAGE_PATHS) {
    const marker = join(repoRoot, packagePath, "package.json");
    const standaloneMarker = join(standaloneRoot, packagePath, "package.json");
    if (hashFile(marker) !== hashFile(standaloneMarker)) {
      violations.push(`${packagePath}/package.json`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Identity source parity violations:\n- ${violations.join("\n- ")}`);
  }
  console.log("Identity source parity verified for runtime-critical paths.");
}

main();
