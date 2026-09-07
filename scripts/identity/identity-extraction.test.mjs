import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { prepareIdentityWorkspace } from "../ci/prepare-identity-lockfile.mjs";
import { IDENTITY_PACKAGES, IDENTITY_PACKAGE_NAMES, IDENTITY_PACKAGE_PATHS } from "./closure.mjs";
import { extractIdentityHistory } from "./extract-history.mjs";
import { importSpecifiers } from "./import-specifiers.mjs";
import { verifyDockerClosureText, verifyPackageClosure } from "./verify-docker-closure.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("closure fixes the six path-preserving workspace packages", () => {
  assert.deepEqual(IDENTITY_PACKAGE_PATHS, [
    "apps/auth",
    "packages/auth",
    "packages/identity-contracts",
    "packages/identity-db",
    "packages/observability",
    "packages/config-ts",
  ]);
  assert.deepEqual(IDENTITY_PACKAGE_NAMES, [
    "@auction/auth-app",
    "@auction/auth",
    "@auction/identity-contracts",
    "@auction/identity-db",
    "@auction/observability",
    "@auction/config-ts",
  ]);
});

test("Docker COPY paths stay aligned with the package closure", () => {
  const dockerfile = readFileSync(join(repoRoot, "apps/auth/Dockerfile"), "utf8");
  assert.deepEqual(verifyDockerClosureText(dockerfile), []);

  const drifted = dockerfile.replaceAll(
    "COPY packages/identity-db/package.json ./packages/identity-db/",
    "",
  );
  assert.match(
    verifyDockerClosureText(drifted).join("\n"),
    /missing manifest COPY packages\/identity-db\/package\.json/,
  );
});

test("package closure rejects an unapproved workspace dependency", () => {
  const root = mkdtempSync(join(tmpdir(), "identity-closure-test-"));
  try {
    for (const entry of IDENTITY_PACKAGES) {
      const path = join(root, entry.path);
      mkdirSync(path, { recursive: true });
      writeFileSync(
        join(path, "package.json"),
        `${JSON.stringify({ name: entry.name, dependencies: {} })}\n`,
      );
    }
    const authManifest = join(root, "apps/auth/package.json");
    writeFileSync(
      authManifest,
      `${JSON.stringify({
        name: "@auction/auth-app",
        dependencies: { "@auction/not-in-closure": "workspace:*" },
      })}\n`,
    );
    assert.match(
      verifyPackageClosure(root).join("\n"),
      /out-of-closure package @auction\/not-in-closure/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("import scanner checks literal and rejects non-literal dynamic imports", () => {
  assert.deepEqual(
    importSpecifiers(`
      import { value } from "@auction/auth";
      export type { Contract } from "@auction/identity-contracts";
      await import("@auction/identity-db/schema");
      await import(packageName);
    `),
    [
      { specifier: "@auction/auth", dynamic: false },
      { specifier: "@auction/identity-contracts", dynamic: false },
      { specifier: "@auction/identity-db/schema", dynamic: true },
      { expression: "packageName", dynamic: true, unresolved: true },
    ],
  );
});

test("bootstrap writes an exact isolated workspace without generating a lockfile", () => {
  const root = mkdtempSync(join(tmpdir(), "identity-bootstrap-test-"));
  try {
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({
        name: "auction",
        packageManager: "pnpm@9.15.4",
        devDependencies: { "@biomejs/biome": "^1.9.4", unrelated: "1.0.0" },
      })}\n`,
    );
    for (const entry of IDENTITY_PACKAGES) {
      const path = join(root, entry.path);
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, "package.json"), `${JSON.stringify({ name: entry.name })}\n`);
    }

    prepareIdentityWorkspace(root, { generateLockfile: false });

    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.deepEqual(manifest.devDependencies, { "@biomejs/biome": "^1.9.4" });
    assert.equal(
      readFileSync(join(root, ".npmrc"), "utf8"),
      [
        "node-linker=isolated",
        "auto-install-peers=false",
        "public-hoist-pattern[]=drizzle-orm",
        "",
      ].join("\n"),
    );
    const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
    for (const path of IDENTITY_PACKAGE_PATHS) assert.match(workspace, new RegExp(path));
    assert.doesNotMatch(workspace, /apps\/\*|packages\/\*/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("history extraction is one path-preserving filter operation", () => {
  const commands = extractIdentityHistory({
    sourceRoot: repoRoot,
    destination: join(tmpdir(), "identity-dry-run"),
    dryRun: true,
  });
  assert.equal(commands.filter((command) => command.startsWith("git filter-repo")).length, 1);
  assert.equal(commands.filter((command) => command === "normalize extracted HEAD to main").length, 1);
  assert.doesNotMatch(commands.join("\n"), /subtree|split\/identity|--path-rename/);
});
