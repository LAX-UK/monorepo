#!/usr/bin/env node
/**
 * Rehearses Identity extraction in a workspace containing only its approved
 * source closure. Generated artifacts and installed dependencies are never
 * copied from the monorepo.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareIdentityRootManifest,
  removeRootImporterFromLockfile,
} from "./prepare-identity-lockfile.mjs";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Identity extraction rehearsal" });

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const rootFiles = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc", ".nvmrc"];
const identityPaths = [
  "apps/auth",
  "packages/auth",
  "packages/identity-contracts",
  "packages/identity-db",
  "packages/observability",
  "packages/config-ts",
];
const allowedWorkspacePackages = new Set([
  "@auction/auth-app",
  "@auction/auth",
  "@auction/identity-contracts",
  "@auction/identity-db",
  "@auction/observability",
  "@auction/config-ts",
]);
const excludedDirectoryNames = new Set(["node_modules", "dist", "coverage", ".turbo"]);

function run(label, command, args, cwd = repoRoot) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`FAILED: ${label}${result.error ? ` (${result.error.message})` : ""}`, {
      cause: result.error,
    });
  }
}

function copyWorkspaceEntry(workspaceRoot, path) {
  const source = join(repoRoot, path);
  if (!existsSync(source)) {
    throw new Error(`Missing required Identity extraction input: ${path}`);
  }
  const destination = join(workspaceRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    filter: (candidate) => {
      const candidateRelativePath = relative(source, candidate);
      return !candidateRelativePath
        .split(sep)
        .some((segment) => excludedDirectoryNames.has(segment));
    },
  });
}

function workspaceManifestPaths(workspaceRoot) {
  return identityPaths
    .map((path) => join(workspaceRoot, path, "package.json"))
    .filter((path) => existsSync(path));
}

function forbiddenWorkspaceDependencies(workspaceRoot) {
  const violations = [];
  for (const manifestPath of workspaceManifestPaths(workspaceRoot)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const dependencyField of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      const dependencies = manifest[dependencyField];
      if (!dependencies || typeof dependencies !== "object") continue;
      for (const dependencyName of Object.keys(dependencies)) {
        if (
          dependencyName.startsWith("@auction/") &&
          !allowedWorkspacePackages.has(dependencyName)
        ) {
          violations.push(
            `${manifest.name ?? manifestPath} ${dependencyField} includes ${dependencyName}`,
          );
        }
      }
    }
  }
  return violations;
}

function assertApprovedClosure(workspaceRoot) {
  const violations = forbiddenWorkspaceDependencies(workspaceRoot);
  if (violations.length > 0) {
    throw new Error(`Forbidden Identity workspace dependencies:\n${violations.join("\n")}`);
  }
}

function proveForbiddenDependencyFails(workspaceRoot) {
  const authManifestPath = join(workspaceRoot, "apps/auth/package.json");
  const original = readFileSync(authManifestPath, "utf8");
  const manifest = JSON.parse(original);
  manifest.dependencies = {
    ...manifest.dependencies,
    "@auction/forbidden-portability-probe": "workspace:*",
  };
  writeFileSync(authManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  try {
    if (forbiddenWorkspaceDependencies(workspaceRoot).length === 0) {
      throw new Error("Forbidden dependency probe was not rejected");
    }
    console.log("Forbidden workspace dependency probe: rejected as expected");
  } finally {
    writeFileSync(authManifestPath, original);
  }
}

function prepareHermeticWorkspace(workspaceRoot) {
  for (const path of rootFiles) copyWorkspaceEntry(workspaceRoot, path);
  for (const path of identityPaths) copyWorkspaceEntry(workspaceRoot, path);
  const lockfilePath = join(workspaceRoot, "pnpm-lock.yaml");
  removeRootImporterFromLockfile(lockfilePath);
  prepareIdentityRootManifest(join(workspaceRoot, "package.json"));
  assertApprovedClosure(workspaceRoot);
  proveForbiddenDependencyFails(workspaceRoot);
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
  const forbiddenPrefixes = ["next@", "sharp@", "vitest@", "@playwright+test@"];
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
  for (const packageRelativePath of identityPaths) {
    rmSync(join(workspaceRoot, packageRelativePath, "node_modules"), {
      force: true,
      recursive: true,
    });
  }
}

const workspaceRoot = mkdtempSync(join(tmpdir(), "auction-identity-rehearsal-"));
const keepWorkspace = process.env.IDENTITY_REHEARSAL_KEEP_TEMP === "1";

try {
  run("Repo split dry run", "bash", ["scripts/identity/repo-split.sh", "--dry-run"]);

  console.log(`\n=== Prepare hermetic workspace (${workspaceRoot}) ===`);
  prepareHermeticWorkspace(workspaceRoot);

  run(
    "Hermetic frozen install",
    "pnpm",
    [
      "--config.node-linker=isolated",
      "install",
      "--frozen-lockfile",
      "--filter",
      "@auction/auth-app...",
    ],
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
  removeWorkspaceNodeModules(workspaceRoot);
  run(
    "Hermetic Identity production install",
    "pnpm",
    [
      "--config.node-linker=isolated",
      "install",
      "--prod",
      "--no-optional",
      "--frozen-lockfile",
      "--filter",
      "@auction/auth-app...",
    ],
    workspaceRoot,
  );
  assertProductionDependencyClosure(workspaceRoot);
  console.log("\nIdentity extraction rehearsal passed.");
} finally {
  if (keepWorkspace) {
    console.log(`Preserving rehearsal workspace: ${workspaceRoot}`);
  } else {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}
