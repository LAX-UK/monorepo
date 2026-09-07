#!/usr/bin/env node
/**
 * Rehearses the same fresh-clone, path-preserving extraction used for a real
 * Identity repository handoff, then proves frozen development and production
 * installs against the generated closure-only lockfile.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_PACKAGE_PATHS } from "../identity/closure.mjs";
import { extractIdentityRepository } from "../identity/extract-identity.mjs";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Identity extraction rehearsal" });

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function run(label, command, args, cwd = repoRoot) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`FAILED: ${label}${result.error ? ` (${result.error.message})` : ""}`, {
      cause: result.error,
    });
  }
}

function assertUnrelatedRootDependenciesWereNotInstalled(workspaceRoot) {
  const rootOnlySentinel = join(workspaceRoot, "node_modules/@aws-sdk/client-s3");
  if (existsSync(rootOnlySentinel)) {
    throw new Error("Filtered install included unrelated root-only dependencies");
  }
  console.log("Filtered install excluded unrelated root-only dependencies");
}

function assertProductionDependencyClosure(workspaceRoot) {
  const virtualStore = join(workspaceRoot, "node_modules/.pnpm");
  const forbiddenPrefixes = ["next@", "sharp@", "vitest@", "@playwright+test@", "bullmq-otel@"];
  const violations = readdirSync(virtualStore).filter((entry) =>
    forbiddenPrefixes.some((prefix) => entry.startsWith(prefix)),
  );
  if (violations.length > 0) {
    throw new Error(
      `Auth production install retained non-runtime packages: ${violations.join(", ")}`,
    );
  }
  console.log("Auth production install excluded optional framework and test dependencies");
}

function removeWorkspaceNodeModules(workspaceRoot) {
  rmSync(join(workspaceRoot, "node_modules"), { force: true, recursive: true });
  for (const packageRelativePath of IDENTITY_PACKAGE_PATHS) {
    rmSync(join(workspaceRoot, packageRelativePath, "node_modules"), {
      force: true,
      recursive: true,
    });
  }
}

const rehearsalTempRoot = process.env.IDENTITY_REHEARSAL_TMPDIR ?? tmpdir();
const workspaceRoot = mkdtempSync(join(rehearsalTempRoot, "auction-identity-rehearsal-"));
const keepWorkspace = process.env.IDENTITY_REHEARSAL_KEEP_TEMP === "1";

try {
  console.log(`\n=== Extract and verify history (${workspaceRoot}) ===`);
  extractIdentityRepository({
    sourceRoot: repoRoot,
    destination: workspaceRoot,
    includeWorkingTree: true,
    scanSecrets: true,
  });

  removeWorkspaceNodeModules(workspaceRoot);
  run(
    "Hermetic Identity production install",
    "pnpm",
    ["install", "--prod", "--no-optional", "--frozen-lockfile", "--filter", "@auction/auth-app..."],
    workspaceRoot,
  );
  assertProductionDependencyClosure(workspaceRoot);
  removeWorkspaceNodeModules(workspaceRoot);
  run(
    "Hermetic frozen install",
    "pnpm",
    ["install", "--frozen-lockfile", "--filter", "@auction/auth-app..."],
    workspaceRoot,
  );
  assertUnrelatedRootDependenciesWereNotInstalled(workspaceRoot);
  run(
    "Hermetic Identity build",
    "pnpm",
    ["--filter", "@auction/auth-app...", "--workspace-concurrency=1", "build"],
    workspaceRoot,
  );
  run(
    "Hermetic Identity typecheck",
    "pnpm",
    ["--filter", "@auction/auth-app...", "--workspace-concurrency=1", "typecheck"],
    workspaceRoot,
  );
  run(
    "Hermetic Identity tests",
    "pnpm",
    ["--filter", "@auction/auth-app...", "--workspace-concurrency=1", "--if-present", "test"],
    workspaceRoot,
  );
  console.log("\nIdentity extraction rehearsal passed.");
} finally {
  if (keepWorkspace) {
    console.log(`Preserving rehearsal workspace: ${workspaceRoot}`);
  } else {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}
