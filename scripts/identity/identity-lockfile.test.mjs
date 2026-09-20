import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  generateIdentityLockfile,
  patchedDependenciesFromLockfile,
  prepareIdentityRootManifest,
  prepareIdentityWorkspace,
  pruneIdentityLockfile,
  rewritePatchedDependencyHashes,
} from "../ci/prepare-identity-lockfile.mjs";
import { IDENTITY_PACKAGES, IDENTITY_PACKAGE_PATHS } from "./closure.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function seedWorkspace(root) {
  const sourceManifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({
      name: "auction",
      packageManager: "pnpm@10.34.5",
      devDependencies: { "@biomejs/biome": "^1.9.4" },
      pnpm: sourceManifest.pnpm,
    })}\n`,
  );
  for (const entry of IDENTITY_PACKAGES) {
    const path = join(root, entry.path);
    mkdirSync(path, { recursive: true });
    writeFileSync(
      join(path, "package.json"),
      readFileSync(join(repoRoot, entry.path, "package.json"), "utf8"),
    );
  }
  cpSync(join(repoRoot, "patches"), join(root, "patches"), { recursive: true });
}

function lockDigest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("Identity closure lock generation is deterministic from the source lock with an empty store", () => {
  const firstRoot = mkdtempSync(join(tmpdir(), "identity-lock-a-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "identity-lock-b-"));
  try {
    for (const root of [firstRoot, secondRoot]) {
      seedWorkspace(root);
      prepareIdentityWorkspace(root, {
        environment: {
          ...process.env,
          npm_config_registry: "http://127.0.0.1:9",
          npm_config_store_dir: join(root, "empty-store"),
        },
        sourceLockfile: join(repoRoot, "pnpm-lock.yaml"),
      });
    }
    assert.equal(
      lockDigest(join(firstRoot, "pnpm-lock.yaml")),
      lockDigest(join(secondRoot, "pnpm-lock.yaml")),
    );
  } finally {
    rmSync(firstRoot, { force: true, recursive: true });
    rmSync(secondRoot, { force: true, recursive: true });
  }
});

test("Identity lock generation requires a source lock", () => {
  const root = mkdtempSync(join(tmpdir(), "identity-lock-no-seed-"));
  try {
    seedWorkspace(root);
    prepareIdentityWorkspace(root, { generateLockfile: false });
    assert.throws(() => generateIdentityLockfile(root), /requires a source lockfile/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("lock pruning preserves patchedDependencies for Identity frozen installs", () => {
  const source = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

patchedDependencies:
  better-auth@1.6.22:
    hash: pgexwqbqhhhylvmy7ape7e2l5i
    path: patches/better-auth@1.6.22.patch

importers:

  .:
    devDependencies:
      '@biomejs/biome':
        specifier: ^1.9.4
        version: 1.9.4

  apps/auth: {}

packages:

  '@biomejs/biome@1.9.4': {}
`;
  const pruned = pruneIdentityLockfile(source, ["apps/auth"]);
  assert.deepEqual(patchedDependenciesFromLockfile(pruned), {
    "better-auth@1.6.22": {
      hash: "pgexwqbqhhhylvmy7ape7e2l5i",
      path: "patches/better-auth@1.6.22.patch",
    },
  });
});

test("Identity lockfile rewrites pnpm 9 patch hashes to pnpm 10 SHA-256", () => {
  const source = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

patchedDependencies:
  better-auth@1.6.22:
    hash: pgexwqbqhhhylvmy7ape7e2l5i
    path: patches/better-auth@1.6.22.patch

importers:

  .:
    devDependencies:
      '@biomejs/biome':
        specifier: ^1.9.4
        version: 1.9.4

  apps/auth: {}

packages:

  '@biomejs/biome@1.9.4': {}
`;
  const root = mkdtempSync(join(tmpdir(), "identity-lock-hash-"));
  try {
    mkdirSync(join(root, "patches"), { recursive: true });
    cpSync(
      join(repoRoot, "patches/better-auth@1.6.22.patch"),
      join(root, "patches/better-auth@1.6.22.patch"),
    );
    const rewritten = rewritePatchedDependencyHashes(root, source);
    assert.deepEqual(patchedDependenciesFromLockfile(rewritten), {
      "better-auth@1.6.22": {
        hash: "2730e70822acf4ad0b3c55364f9d3920f0dcce3d21c71117a661f9207421613d",
        path: "patches/better-auth@1.6.22.patch",
      },
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("Identity root manifest copies patchedDependencies and lock generation pins hashes", () => {
  const root = mkdtempSync(join(tmpdir(), "identity-lock-patches-"));
  try {
    seedWorkspace(root);
    prepareIdentityRootManifest(join(root, "package.json"), IDENTITY_PACKAGE_PATHS);
    const before = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(
      before.pnpm.patchedDependencies["better-auth@1.6.22"],
      "patches/better-auth@1.6.22.patch",
    );
    generateIdentityLockfile(root, {
      environment: {
        ...process.env,
        npm_config_registry: "http://127.0.0.1:9",
        npm_config_store_dir: join(root, "empty-store"),
      },
      sourceLockfile: join(repoRoot, "pnpm-lock.yaml"),
    });
    const after = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(
      after.pnpm.patchedDependencies["better-auth@1.6.22"],
      "patches/better-auth@1.6.22.patch",
    );
    assert.match(
      readFileSync(join(root, "pnpm-lock.yaml"), "utf8"),
      /hash: 2730e70822acf4ad0b3c55364f9d3920f0dcce3d21c71117a661f9207421613d/,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("lock pruning treats empty importers as distinct importer boundaries", () => {
  const source = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    devDependencies:
      '@biomejs/biome':
        specifier: ^1.9.4
        version: 1.9.4

  apps/auth: {}

  packages/config-ts: {}

  packages/not-identity: {}

packages:

  '@biomejs/biome@1.9.4': {}
`;
  const pruned = pruneIdentityLockfile(source, ["apps/auth", "packages/config-ts"]);
  assert.match(pruned, / {2}apps\/auth: \{\}/);
  assert.match(pruned, / {2}packages\/config-ts: \{\}/);
  assert.doesNotMatch(pruned, /packages\/not-identity/);
});

test("Identity lock generation rejects non-closure importers", () => {
  const root = mkdtempSync(join(tmpdir(), "identity-lock-reject-"));
  try {
    seedWorkspace(root);
    prepareIdentityWorkspace(root, {
      generateLockfile: false,
      sourceLockfile: join(repoRoot, "pnpm-lock.yaml"),
    });
    const lockfilePath = join(root, "pnpm-lock.yaml");
    generateIdentityLockfile(root, { sourceLockfile: join(repoRoot, "pnpm-lock.yaml") });
    const lockfile = readFileSync(lockfilePath, "utf8");
    const importersBlock = lockfile.split("importers:")[1]?.split("\npackages:")[0] ?? "";
    const importerRoots = importersBlock
      .split("\n")
      .filter((line) => /^ {2}[^ ]/.test(line))
      .map((line) => line.trim().split(":")[0]?.trim())
      .filter(Boolean);
    assert.deepEqual(importerRoots.sort(), [".", ...IDENTITY_PACKAGE_PATHS].sort());
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
