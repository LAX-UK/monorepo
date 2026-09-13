#!/usr/bin/env node
/**
 * Hermetic Identity acceptance preflight: migrated PostgreSQL 16, Redis 7, production
 * Auth settings, and local equivalents of staging live probes. Fails closed on any
 * missing prerequisite; no silent skip paths.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Identity acceptance preflight" });

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const logDir =
  process.env.IDENTITY_PREFLIGHT_LOG_DIR ?? join(repoRoot, ".tmp/identity-preflight-logs");

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/auction_ci";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const env = {
  ...process.env,
  CI: "true",
  DATABASE_URL: databaseUrl,
  DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER ?? databaseUrl,
  REDIS_URL: redisUrl,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? "ci-auth-secret-at-least-sixteen-characters",
  AUTH_DEK_KEY:
    process.env.AUTH_DEK_KEY ?? "0707070707070707070707070707070707070707070707070707070707070707",
  IDENTITY_MACHINE_CLIENT_ID: process.env.IDENTITY_MACHINE_CLIENT_ID ?? "api-service",
  IDENTITY_MACHINE_CLIENT_SECRET:
    process.env.IDENTITY_MACHINE_CLIENT_SECRET ?? "ci-identity-machine-secret-at-least-32",
  OIDC_CLIENT_SECRET_LAX_BID_WEB:
    process.env.OIDC_CLIENT_SECRET_LAX_BID_WEB ?? "ci-bid-web-client-secret-at-least-32",
  OIDC_CLIENT_SECRET_LAX_SHOP_WEB:
    process.env.OIDC_CLIENT_SECRET_LAX_SHOP_WEB ?? "ci-shop-identity-client-secret-at-least-32",
  AUTH_APP_DB_PASSWORD: process.env.AUTH_APP_DB_PASSWORD ?? "postgres",
  API_APP_DB_PASSWORD: process.env.API_APP_DB_PASSWORD ?? "postgres",
  SHOP_APP_DB_PASSWORD: process.env.SHOP_APP_DB_PASSWORD ?? "postgres",
  WORKER_APP_DB_PASSWORD: process.env.WORKER_APP_DB_PASSWORD ?? "postgres",
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  AUTH_BASE_URL: process.env.AUTH_BASE_URL ?? "http://localhost:3003",
  API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:3001",
  SHOP_IDENTITY_BASE_URL: process.env.SHOP_IDENTITY_BASE_URL ?? "http://localhost:3010",
  OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL ?? "http://localhost:3003",
  OIDC_INTERNAL_BASE_URL: process.env.OIDC_INTERNAL_BASE_URL ?? "http://localhost:3003",
  NODE_ENV: "production",
  APP_ENV: "test",
  ALLOW_HTTP_COOKIES: "true",
  REQUIRE_EMAIL_VERIFICATION: "false",
  SSF_DELIVERY_ENABLED: "false",
  PORT: "3003",
  SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? "identity-preflight-local",
};

function run(label, command, args = [], extraEnv = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

async function waitFor(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = spawnSync("curl", ["--fail", "--silent", url], { encoding: "utf8" });
    if (probe.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  mkdirSync(logDir, { recursive: true });
  await import("./ensure-ci-database.mjs");

  run("Build db closure", "pnpm", ["--filter", "@auction/db...", "build"]);
  run("Apply migrations through 0161", "pnpm", ["--filter", "@auction/db", "db:migrate"]);
  run("Seed dev fixtures", "pnpm", ["--filter", "@auction/db", "db:seed:dev"]);
  run("Apply role grants", "pnpm", ["--filter", "@auction/db", "db:roles"]);
  run("Configure OIDC clients", "pnpm", ["--filter", "@auction/db", "db:configure-oidc-clients"]);
  run("Seed acceptance-shaped OAuth fixtures", "node", [
    "scripts/ci/seed-identity-acceptance-fixtures.mjs",
  ]);

  run("Build auth and shop identity", "pnpm", ["--filter", "@auction/auth-app...", "build"]);
  run("Build shop identity app", "pnpm", ["--filter", "@auction/shop-identity...", "build"]);

  const authLog = join(logDir, "auth.log");
  const shopLog = join(logDir, "shop-identity.log");
  const auth = spawn("pnpm", ["--filter", "@auction/auth-app", "start"], {
    cwd: repoRoot,
    env: { ...env, PORT: "3003" },
    stdio: ["ignore", "open", authLog, "open", authLog],
  });
  const shopIdentity = spawn("pnpm", ["--filter", "@auction/shop-identity", "start"], {
    cwd: repoRoot,
    env: {
      ...env,
      PORT: "3010",
      OIDC_CLIENT_ID: "lax-shop-web",
      OIDC_CLIENT_SECRET: env.OIDC_CLIENT_SECRET_LAX_SHOP_WEB,
      OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3010/",
      SESSION_SECRET: "ci-shop-identity-session-secret-at-least-32",
      DATABASE_URL_SHOP: databaseUrl,
    },
    stdio: ["ignore", "open", shopLog, "open", shopLog],
  });

  try {
    await waitFor("http://localhost:3003/health/ready");
    await waitFor("http://localhost:3010/health/ready");

    run("Identity boundary probes", "node", ["scripts/ci/verify-identity-boundary.mjs", "--live"]);
    run("Shop OIDC roundtrip", "node", ["scripts/ci/verify-shop-oidc-roundtrip.mjs"], {
      SHOP_OIDC_TEST_EMAIL: "admin@lax.bid",
      SHOP_OIDC_TEST_PASSWORD: "Password123!",
    });
    run("Refresh reuse protection", "node", ["scripts/ci/verify-refresh-reuse.mjs"], {
      REFRESH_TEST_EMAIL: "admin@lax.bid",
      REFRESH_TEST_PASSWORD: "Password123!",
      REFRESH_TEST_CLIENT_SECRET: env.OIDC_CLIENT_SECRET_LAX_SHOP_WEB,
    });
    run("Directory drift (read-only)", "pnpm", [
      "tsx",
      "scripts/ci/verify-identity-directory-drift.mjs",
    ]);
    run("Outbox lag (read-only)", "pnpm", ["tsx", "scripts/ci/verify-identity-outbox-live.mjs"], {
      IDENTITY_OUTBOX_MAX_AGE_MS: "300000",
    });
    run(
      "Auth at-rest null refresh_token_hash fixture",
      "pnpm",
      ["--filter", "@auction/db", "test", "--", "auth-at-rest/apply.integration"],
      {
        MIGRATION_TEST_DATABASE_URL: databaseUrl,
      },
    );
  } finally {
    auth.kill("SIGTERM");
    shopIdentity.kill("SIGTERM");
    await Promise.allSettled([
      new Promise((resolve) => auth.on("exit", resolve)),
      new Promise((resolve) => shopIdentity.on("exit", resolve)),
    ]);
  }

  console.log("\nIdentity acceptance preflight passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
