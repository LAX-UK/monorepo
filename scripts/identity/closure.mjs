/**
 * Single source of truth for the path-preserving Identity repository closure.
 *
 * Keep this module data-only so extraction, Docker drift checks, layer checks,
 * and standalone verification all consume the same contract.
 */
export const IDENTITY_PACKAGES = Object.freeze([
  Object.freeze({ path: "apps/auth", name: "@auction/auth-app" }),
  Object.freeze({ path: "packages/auth", name: "@auction/auth" }),
  Object.freeze({
    path: "packages/identity-contracts",
    name: "@auction/identity-contracts",
  }),
  Object.freeze({ path: "packages/identity-db", name: "@auction/identity-db" }),
  Object.freeze({ path: "packages/observability", name: "@auction/observability" }),
  Object.freeze({ path: "packages/config-ts", name: "@auction/config-ts" }),
]);

export const IDENTITY_PACKAGE_PATHS = Object.freeze(IDENTITY_PACKAGES.map(({ path }) => path));

export const IDENTITY_PACKAGE_NAMES = Object.freeze(IDENTITY_PACKAGES.map(({ name }) => name));

export const IDENTITY_ROOT_FILES = Object.freeze([
  ".nvmrc",
  ".npmrc",
  "biome.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
]);

export const IDENTITY_SCRIPT_FILES = Object.freeze([
  "scripts/check-layers.mjs",
  "scripts/ci/prepare-identity-lockfile.mjs",
  "scripts/ci/verify-identity-extractability.mjs",
  "scripts/identity",
]);

export const IDENTITY_FILTER_PATHS = Object.freeze([
  ...IDENTITY_PACKAGE_PATHS,
  ...IDENTITY_ROOT_FILES,
  ...IDENTITY_SCRIPT_FILES,
]);

export const IDENTITY_GENERATED_ROOT_FILES = Object.freeze([
  "package.json",
  "pnpm-workspace.yaml",
  ".npmrc",
  "biome.json",
  "pnpm-lock.yaml",
]);

export const IDENTITY_DOCKER = Object.freeze({
  dockerfile: "apps/auth/Dockerfile",
  workspaceFilter: "@auction/auth-app...",
  prepareScript: "scripts/ci/prepare-identity-lockfile.mjs",
  manifestCopyPaths: Object.freeze(IDENTITY_PACKAGE_PATHS.map((path) => `${path}/package.json`)),
  sourceCopyPaths: IDENTITY_PACKAGE_PATHS,
});

export const IDENTITY_ALLOWED_TOP_LEVEL = Object.freeze([
  ".git",
  ".nvmrc",
  ".npmrc",
  "apps",
  "biome.json",
  "node_modules",
  "package.json",
  "packages",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts",
]);
