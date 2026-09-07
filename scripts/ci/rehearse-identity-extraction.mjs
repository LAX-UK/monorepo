#!/usr/bin/env node
/**
 * Rehearses the same fresh-clone, path-preserving extraction used for a real
 * Identity repository handoff, then proves frozen development and production
 * installs against the generated closure-only lockfile.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_PACKAGE_PATHS } from "../identity/closure.mjs";
import { extractIdentityRepository } from "../identity/extract-identity.mjs";
import { IDENTITY_PNPM_VERSION } from "./prepare-identity-lockfile.mjs";
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

function runIdentityPnpm(label, args, cwd) {
  run(label, "corepack", [`pnpm@${IDENTITY_PNPM_VERSION}`, ...args], cwd);
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
mkdirSync(rehearsalTempRoot, { recursive: true });
if (process.env.IDENTITY_PNPM_STORE_DIR) {
  process.env.npm_config_store_dir = process.env.IDENTITY_PNPM_STORE_DIR;
}
const workspaceRoot = mkdtempSync(join(rehearsalTempRoot, "auction-identity-rehearsal-"));
const keepWorkspace = process.env.IDENTITY_REHEARSAL_KEEP_TEMP === "1";
let failed = false;

function sanitizedPnpmConfig() {
  const result = spawnSync("corepack", [`pnpm@${IDENTITY_PNPM_VERSION}`, "config", "list"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return output
    .split(/\r?\n/)
    .map((line) =>
      /(?:auth|password|secret|token)\s*=/i.test(line)
        ? `${line.slice(0, Math.max(0, line.indexOf("=") + 1))}[REDACTED]`
        : line,
    )
    .join("\n");
}

function captureFailureDiagnostics(error) {
  const diagnosticsRoot = join(rehearsalTempRoot, "diagnostics");
  mkdirSync(diagnosticsRoot, { recursive: true });
  for (const name of ["pnpm-lock.yaml", ".npmrc", "pnpm-workspace.yaml"]) {
    const source = join(workspaceRoot, name);
    if (existsSync(source)) copyFileSync(source, join(diagnosticsRoot, name));
  }
  writeFileSync(join(diagnosticsRoot, "pnpm-config.txt"), sanitizedPnpmConfig());
  writeFileSync(join(diagnosticsRoot, "failure.txt"), `${error.stack ?? error}\n`);
  console.error(`Identity rehearsal diagnostics captured in ${diagnosticsRoot}`);
}

try {
  console.log(`\n=== Extract and verify history (${workspaceRoot}) ===`);
  extractIdentityRepository({
    sourceRoot: repoRoot,
    destination: workspaceRoot,
    includeWorkingTree: true,
    scanSecrets: true,
  });

  removeWorkspaceNodeModules(workspaceRoot);
  runIdentityPnpm(
    "Hermetic Identity production install",
    ["install", "--prod", "--no-optional", "--frozen-lockfile", "--filter", "@auction/auth-app..."],
    workspaceRoot,
  );
  assertProductionDependencyClosure(workspaceRoot);
  removeWorkspaceNodeModules(workspaceRoot);
  runIdentityPnpm(
    "Hermetic frozen install",
    ["install", "--frozen-lockfile", "--filter", "@auction/auth-app..."],
    workspaceRoot,
  );
  assertUnrelatedRootDependenciesWereNotInstalled(workspaceRoot);
  runIdentityPnpm(
    "Hermetic Identity build",
    ["--filter", "@auction/auth-app...", "--workspace-concurrency=1", "build"],
    workspaceRoot,
  );
  runIdentityPnpm(
    "Hermetic Identity typecheck",
    ["--filter", "@auction/auth-app...", "--workspace-concurrency=1", "typecheck"],
    workspaceRoot,
  );
  runIdentityPnpm(
    "Hermetic Identity tests",
    ["--filter", "@auction/auth-app...", "--workspace-concurrency=1", "--if-present", "test"],
    workspaceRoot,
  );
  console.log("\nIdentity extraction rehearsal passed.");
} catch (error) {
  failed = true;
  try {
    captureFailureDiagnostics(error);
  } catch (diagnosticError) {
    console.error(`Could not capture Identity rehearsal diagnostics: ${diagnosticError}`);
  }
  throw error;
} finally {
  if (keepWorkspace || failed) {
    console.log(`Preserving rehearsal workspace: ${workspaceRoot}`);
  } else {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}
