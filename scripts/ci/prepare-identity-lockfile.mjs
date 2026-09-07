#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BIOME_CONFIG = {
  $schema: "https://biomejs.dev/schemas/1.9.4/schema.json",
  vcs: { enabled: true, clientKind: "git", useIgnoreFile: true },
  files: {
    ignore: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/pnpm-lock.yaml"],
  },
  formatter: { indentStyle: "space", indentWidth: 2, lineWidth: 100 },
  organizeImports: { enabled: true },
  linter: { enabled: true, rules: { recommended: true } },
  javascript: { formatter: { quoteStyle: "double", semicolons: "always" } },
};

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function discoverWorkspacePackagePaths(workspaceRoot) {
  const paths = [];
  for (const base of ["apps", "packages"]) {
    const basePath = join(workspaceRoot, base);
    if (!existsSync(basePath)) continue;
    for (const entry of readdirSync(basePath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packagePath = join(basePath, entry.name);
      if (existsSync(join(packagePath, "package.json"))) {
        paths.push(relative(workspaceRoot, packagePath).replaceAll("\\", "/"));
      }
    }
  }
  return paths.sort();
}

export function prepareIdentityRootManifest(manifestPath, workspacePaths) {
  const manifest = json(manifestPath);
  const biomeVersion = manifest.devDependencies?.["@biomejs/biome"] ?? "^1.9.4";
  const identityManifest = {
    name: `${manifest.name ?? "workspace"}-identity`,
    private: true,
    type: "module",
    ...(manifest.packageManager ? { packageManager: manifest.packageManager } : {}),
    ...(manifest.engines ? { engines: manifest.engines } : {}),
    scripts: {
      build: "pnpm --filter @auction/auth-app... --workspace-concurrency=1 build",
      lint: "biome check .",
      "lint:layers": "node scripts/check-layers.mjs",
      typecheck: "pnpm --filter @auction/auth-app... --workspace-concurrency=1 typecheck",
      test: "pnpm --filter @auction/auth-app... --workspace-concurrency=1 --if-present test",
      "ci:identity-extractability": "node scripts/ci/verify-identity-extractability.mjs",
      "ci:verify":
        "pnpm lint && pnpm lint:layers && pnpm ci:identity-extractability && pnpm typecheck && pnpm test && pnpm build",
    },
    ...(manifest.pnpm?.overrides ? { pnpm: { overrides: manifest.pnpm.overrides } } : {}),
    devDependencies: {
      "@biomejs/biome": biomeVersion,
    },
  };
  writeJson(manifestPath, identityManifest);

  const workspaceRoot = dirname(manifestPath);
  writeFileSync(
    join(workspaceRoot, "pnpm-workspace.yaml"),
    [
      "packages:",
      ...workspacePaths.map((path) => `  - "${path}"`),
      "",
      "# Keep the closure lockfile valid for macOS development and the Linux",
      "# glibc/musl targets used by CI and the production Alpine image.",
      "supportedArchitectures:",
      "  os:",
      "    - current",
      "    - linux",
      "    - darwin",
      "  cpu:",
      "    - current",
      "    - x64",
      "    - arm64",
      "    - wasm32",
      "  libc:",
      "    - current",
      "    - glibc",
      "    - musl",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(workspaceRoot, ".npmrc"),
    "node-linker=isolated\nauto-install-peers=false\npublic-hoist-pattern[]=drizzle-orm\n",
  );
  writeJson(join(workspaceRoot, "biome.json"), BIOME_CONFIG);
}

/** Generate a native lock from only the six-package standalone workspace. */
export function generateIdentityLockfile(workspaceRoot) {
  const lockfilePath = join(workspaceRoot, "pnpm-lock.yaml");
  rmSync(lockfilePath, { force: true });
  const result = spawnSync("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], {
    cwd: workspaceRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      `pnpm failed to generate the Identity lockfile${result.error ? `: ${result.error.message}` : ""}`,
    );
  }
}

export function prepareIdentityWorkspace(workspaceRoot, { generateLockfile = true } = {}) {
  const workspacePaths = discoverWorkspacePackagePaths(workspaceRoot);
  if (workspacePaths.length === 0) {
    throw new Error(`No workspace packages found in ${workspaceRoot}`);
  }
  prepareIdentityRootManifest(join(workspaceRoot, "package.json"), workspacePaths);
  if (generateLockfile) {
    generateIdentityLockfile(workspaceRoot);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const lockfilePath = resolve(process.argv[2] ?? "pnpm-lock.yaml");
  const manifestPath = resolve(process.argv[3] ?? join(dirname(lockfilePath), "package.json"));
  if (dirname(lockfilePath) !== dirname(manifestPath)) {
    throw new Error("Identity lockfile and root manifest must share a directory");
  }
  prepareIdentityWorkspace(dirname(manifestPath));
}
