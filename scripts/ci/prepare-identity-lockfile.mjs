#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const IDENTITY_PNPM_VERSION = "10.34.5";

const IDENTITY_WORKSPACE_CONFIG_ENV =
  /^npm_config_(?:node_linker|auto_install_peers|dedupe_peer_dependents|public_hoist_pattern)$/i;

export function identityPnpmEnvironment(source = process.env) {
  const environment = { ...source };
  for (const name of Object.keys(environment)) {
    if (IDENTITY_WORKSPACE_CONFIG_ENV.test(name)) delete environment[name];
  }
  return environment;
}

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
    packageManager: `pnpm@${IDENTITY_PNPM_VERSION}`,
    ...(manifest.engines ? { engines: manifest.engines } : {}),
    scripts: {
      build: "pnpm --filter @auction/auth-app... --workspace-concurrency=1 build",
      lint: "biome check .",
      "lint:layers": "node scripts/check-layers.mjs",
      typecheck: "pnpm --filter @auction/auth-app... --workspace-concurrency=1 typecheck",
      test: "pnpm test:unit",
      "test:unit": `corepack pnpm@${IDENTITY_PNPM_VERSION} --filter @auction/auth-app... --workspace-concurrency=1 --if-present test --exclude='**/*.integration.test.ts'`,
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
    "node-linker=isolated\nauto-install-peers=false\ndedupe-peer-dependents=false\npublic-hoist-pattern[]=drizzle-orm\n",
  );
  writeJson(join(workspaceRoot, "biome.json"), BIOME_CONFIG);
}

/** Prune a copied source lock to the closure without resolving dependencies online. */
export function generateIdentityLockfile(workspaceRoot, options = {}) {
  const lockfilePath = join(workspaceRoot, "pnpm-lock.yaml");
  if (!options.sourceLockfile) {
    throw new Error("Identity lock generation requires a source lockfile");
  }
  if (!existsSync(options.sourceLockfile)) {
    throw new Error(`Identity lock seed not found: ${options.sourceLockfile}`);
  }
  const workspacePaths = discoverWorkspacePackagePaths(workspaceRoot);
  const sourceLockfile = readFileSync(options.sourceLockfile, "utf8");
  writeFileSync(lockfilePath, pruneIdentityLockfile(sourceLockfile, workspacePaths));

  const result = spawnSync(
    "corepack",
    [
      `pnpm@${IDENTITY_PNPM_VERSION}`,
      "install",
      "--lockfile-only",
      "--offline",
      "--ignore-scripts",
      "--frozen-lockfile",
      "--filter",
      "@auction/auth-app...",
    ],
    {
      cwd: workspaceRoot,
      env: identityPnpmEnvironment(options.environment),
      stdio: "inherit",
    },
  );
  const productionResult =
    result.status === 0
      ? spawnSync(
          "corepack",
          [
            `pnpm@${IDENTITY_PNPM_VERSION}`,
            "install",
            "--lockfile-only",
            "--offline",
            "--prod",
            "--no-optional",
            "--ignore-scripts",
            "--frozen-lockfile",
            "--filter",
            "@auction/auth-app...",
          ],
          {
            cwd: workspaceRoot,
            env: identityPnpmEnvironment(options.environment),
            stdio: "inherit",
          },
        )
      : undefined;
  rmSync(join(workspaceRoot, "node_modules"), { force: true, recursive: true });
  for (const workspacePath of discoverWorkspacePackagePaths(workspaceRoot)) {
    rmSync(join(workspaceRoot, workspacePath, "node_modules"), {
      force: true,
      recursive: true,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `pnpm failed to prune the Identity lockfile${result.error ? `: ${result.error.message}` : ""}`,
    );
  }
  if (productionResult?.status !== 0) {
    throw new Error(
      `pnpm failed to validate the Identity production lockfile${
        productionResult?.error ? `: ${productionResult.error.message}` : ""
      }`,
    );
  }
}

/**
 * Retains only Identity importers. The package and snapshot graphs remain from
 * the validated source lock; pnpm tolerates unreachable entries and frozen,
 * offline validation proves all retained importers are closed.
 */
export function pruneIdentityLockfile(source, workspacePaths) {
  const importersStart = source.indexOf("importers:\n");
  const packagesStart = source.indexOf("\npackages:\n", importersStart);
  if (importersStart === -1 || packagesStart === -1) {
    throw new Error("Source lockfile does not contain pnpm v9 importers and packages sections");
  }

  const importerSection = source.slice(importersStart + "importers:\n".length, packagesStart);
  const importerMatches = [...importerSection.matchAll(/^ {2}([^ ].*?):(?: \{\})?$/gm)];
  const importers = new Map();
  for (const [index, match] of importerMatches.entries()) {
    const start = match.index;
    const end = importerMatches[index + 1]?.index ?? importerSection.length;
    importers.set(match[1], importerSection.slice(start, end).trimEnd());
  }

  const rootImporter = importers.get(".");
  const biome = rootImporter?.match(
    /\n {6}'@biomejs\/biome':\n {8}specifier: ([^\n]+)\n {8}version: ([^\n]+)/,
  );
  if (!biome) {
    throw new Error("Source lockfile root importer does not pin @biomejs/biome");
  }

  const retained = [
    [
      "  .:",
      "    devDependencies:",
      "      '@biomejs/biome':",
      `        specifier: ${biome[1]}`,
      `        version: ${biome[2]}`,
    ].join("\n"),
  ];
  for (const path of workspacePaths) {
    const importer = importers.get(path);
    // Older lockfiles may omit dependency-free importers; current pnpm writes `{}`.
    if (importer) retained.push(importer);
  }

  const prefix = source
    .slice(0, importersStart)
    .replace(/(^settings:\n(?:^ {2}.*\n)*)/m, (settings) =>
      settings.replace(/^ {2}autoInstallPeers: .+$/m, "  autoInstallPeers: false"),
    );
  return `${prefix}importers:\n\n${retained.join("\n\n")}\n${source.slice(packagesStart + 1)}`;
}

export function prepareIdentityWorkspace(
  workspaceRoot,
  { environment, generateLockfile = true, sourceLockfile } = {},
) {
  const workspacePaths = discoverWorkspacePackagePaths(workspaceRoot);
  if (workspacePaths.length === 0) {
    throw new Error(`No workspace packages found in ${workspaceRoot}`);
  }
  prepareIdentityRootManifest(join(workspaceRoot, "package.json"), workspacePaths);
  if (generateLockfile) {
    generateIdentityLockfile(workspaceRoot, { environment, sourceLockfile });
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const lockfilePath = resolve(process.argv[2] ?? "pnpm-lock.yaml");
  const manifestPath = resolve(process.argv[3] ?? join(dirname(lockfilePath), "package.json"));
  const sourceLockfile = process.argv[4] ? resolve(process.argv[4]) : undefined;
  if (dirname(lockfilePath) !== dirname(manifestPath)) {
    throw new Error("Identity lockfile and root manifest must share a directory");
  }
  prepareIdentityWorkspace(dirname(manifestPath), { sourceLockfile });
}
