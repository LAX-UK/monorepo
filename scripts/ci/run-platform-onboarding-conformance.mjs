#!/usr/bin/env node
/**
 * Runs the executable onboarding conformance template for Shop and registry contracts.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Platform onboarding conformance" });

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function run(label, command, args, env = process.env) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env,
  });
  if (result.status !== 0) {
    console.error(`FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("Identity boundary (fixture)", "pnpm", ["ci:identity-boundary"]);
run("Shop app role contract", "pnpm", ["--filter", "@auction/db", "test:shop-role-contract"], {
  ...process.env,
  AUTH_ROLE_CONTRACT_REQUIRED: "true",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/auction_ci",
  DATABASE_URL_OWNER:
    process.env.DATABASE_URL_OWNER ??
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/auction_ci",
  DATABASE_URL_SHOP:
    process.env.DATABASE_URL_SHOP ?? "postgresql://shop_app:postgres@localhost:5432/auction_ci",
  SHOP_APP_DB_PASSWORD: process.env.SHOP_APP_DB_PASSWORD ?? "postgres",
});

if (process.env.PLATFORM_CONFORMANCE_LIVE === "1") {
  run("Shop OIDC roundtrip (live)", "node", ["scripts/ci/verify-shop-oidc-roundtrip.mjs"]);
}

console.log("\nPlatform onboarding conformance passed.");
