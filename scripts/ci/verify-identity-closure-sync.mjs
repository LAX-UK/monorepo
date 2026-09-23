#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Fails when monorepo Identity closure bytes differ from lax-identity at --ref
 * (default main). Monorepo is source of truth; sync via scripts/identity/repo-split.sh.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDENTITY_PACKAGE_PATHS } from "../identity/closure.mjs";
import {
  IDENTITY_ROOT_MANIFEST_FILES,
  listClosureSyncRelativePaths,
} from "../identity/list-closure-sync-paths.mjs";
import { prepareIdentityRootManifest } from "./prepare-identity-lockfile.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const LAX_IDENTITY_REPO =
  process.env.LAX_IDENTITY_REPO ?? "https://github.com/LAX-UK/lax-identity.git";

function parseArgs(argv) {
  let ref = "main";
  let standaloneRoot = process.env.LAX_IDENTITY_ROOT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ref") {
      ref = argv[index + 1] ?? ref;
      index += 1;
      continue;
    }
    if (arg === "--standalone-root") {
      standaloneRoot = argv[index + 1];
      index += 1;
    }
  }
  return { ref, standaloneRoot };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(command, args, options = {}) {
  const { cwd, capture } = options;
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout?.trim() ?? "";
}

function resolveStandaloneRoot(ref, explicitRoot) {
  if (explicitRoot) return explicitRoot;
  const tempRoot = mkdtempSync(join(tmpdir(), "lax-identity-sync-"));
  if (ref === "main") {
    run("git", ["clone", "--depth", "1", "--branch", "main", LAX_IDENTITY_REPO, tempRoot], {
      capture: true,
    });
    return tempRoot;
  }
  run("git", ["init", tempRoot], { capture: true, cwd: tempRoot });
  run("git", ["remote", "add", "origin", LAX_IDENTITY_REPO], { capture: true, cwd: tempRoot });
  run("git", ["fetch", "--depth", "1", "origin", ref], { capture: true, cwd: tempRoot });
  run("git", ["checkout", "FETCH_HEAD"], { capture: true, cwd: tempRoot });
  return tempRoot;
}

function expectedRootManifestHashes(monorepoRoot) {
  const tempRoot = mkdtempSync(join(tmpdir(), "identity-root-manifest-"));
  try {
    copyFileSync(join(monorepoRoot, "package.json"), join(tempRoot, "package.json"));
    prepareIdentityRootManifest(join(tempRoot, "package.json"), IDENTITY_PACKAGE_PATHS);
    /** @type {Record<string, string>} */
    const hashes = {};
    for (const name of IDENTITY_ROOT_MANIFEST_FILES) {
      hashes[name] = sha256File(join(tempRoot, name));
    }
    return hashes;
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
}

function compareTrees(monorepoRoot, standaloneRoot) {
  const violations = [];
  const relativePaths = listClosureSyncRelativePaths(monorepoRoot);
  const expectedRoot = expectedRootManifestHashes(monorepoRoot);

  for (const relativePath of relativePaths) {
    const monorepoPath = join(monorepoRoot, relativePath);
    const standalonePath = join(standaloneRoot, relativePath);
    if (!existsSync(monorepoPath)) {
      violations.push(`${relativePath} (missing in monorepo)`);
      continue;
    }
    if (!existsSync(standalonePath)) {
      violations.push(`${relativePath} (missing in lax-identity)`);
      continue;
    }
    if (sha256File(monorepoPath) !== sha256File(standalonePath)) {
      violations.push(relativePath);
    }
  }

  for (const name of IDENTITY_ROOT_MANIFEST_FILES) {
    const standalonePath = join(standaloneRoot, name);
    if (!existsSync(standalonePath)) {
      violations.push(`${name} (missing in lax-identity)`);
      continue;
    }
    if (sha256File(standalonePath) !== expectedRoot[name]) {
      violations.push(`${name} (root manifest drift — run scripts/identity/repo-split.sh)`);
    }
  }

  return violations;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const ref = parsed.ref ?? process.env.LAX_IDENTITY_CLOSURE_REF ?? "main";
  const explicitRoot = parsed.standaloneRoot;
  if (!/^[0-9a-f]{40}$|^main$/.test(ref)) {
    throw new Error("--ref must be main or a full 40-char commit SHA");
  }

  let standaloneRoot;
  let cleanupRoot = false;
  try {
    standaloneRoot = resolveStandaloneRoot(ref, explicitRoot);
    cleanupRoot = !explicitRoot;
    const violations = compareTrees(repoRoot, standaloneRoot);
    if (violations.length > 0) {
      console.error(
        `Identity closure drift vs lax-identity@${ref} (${violations.length} path(s)):\n- ${violations.join("\n- ")}`,
      );
      console.error(
        "\nMonorepo is source of truth. Sync lax-identity with scripts/identity/repo-split.sh and open a PR there before pinning staging recovery.",
      );
      process.exit(1);
    }
    console.log(`Identity closure matches lax-identity@${ref}.`);
  } finally {
    if (cleanupRoot && standaloneRoot) {
      rmSync(standaloneRoot, { force: true, recursive: true });
    }
  }
}

main();
