#!/usr/bin/env node
/**
 * Mirror GitHub PR CI locally before pushing.
 *
 * Usage:
 *   node scripts/ci/run-pr-ci-local.mjs
 *   node scripts/ci/run-pr-ci-local.mjs --with-browser-build
 *
 * Requires:
 *   - Postgres on localhost:5432 (database auction_ci)
 *   - Redis on localhost:6379
 *   - gitleaks on PATH (same scan CI runs)
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const withBrowserBuild = process.argv.includes("--with-browser-build");

function stripRoleContractEnv(source) {
  const {
    DATABASE_URL_AUTH: _authUrl,
    DATABASE_URL_API: _apiUrl,
    DATABASE_URL_SHOP: _shopUrl,
    DATABASE_URL_WORKER: _workerUrl,
    AUTH_APP_DATABASE_URL: _authAppUrl,
    API_APP_DATABASE_URL: _apiAppUrl,
    WORKER_APP_DATABASE_URL: _workerAppUrl,
    AUTH_ROLE_CONTRACT_REQUIRED: _authRoleRequired,
    WORKER_ROLE_CONTRACT_REQUIRED: _workerRoleRequired,
    ...env
  } = source;
  return env;
}

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/auction_ci";

const baseEnv = stripRoleContractEnv({
  ...process.env,
  CI: "true",
  SSF_DELIVERY_ENABLED: process.env.SSF_DELIVERY_ENABLED ?? "false",
  SSF_DELIVERY_TIMEOUT_MS: process.env.SSF_DELIVERY_TIMEOUT_MS ?? "5000",
  SSF_DELIVERY_MAX_ATTEMPTS: process.env.SSF_DELIVERY_MAX_ATTEMPTS ?? "8",
  DATABASE_URL: databaseUrl,
  MIGRATION_TEST_DATABASE_URL: process.env.MIGRATION_TEST_DATABASE_URL ?? databaseUrl,
  REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});

const workerRoleEnv = stripRoleContractEnv({
  ...baseEnv,
  DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER ?? databaseUrl,
  DATABASE_URL_WORKER:
    process.env.DATABASE_URL_WORKER ?? "postgresql://worker_app:postgres@localhost:5432/auction_ci",
  WORKER_APP_DB_PASSWORD: process.env.WORKER_APP_DB_PASSWORD ?? "postgres",
  API_APP_DB_PASSWORD: process.env.API_APP_DB_PASSWORD ?? "postgres",
  AUTH_APP_DB_PASSWORD: process.env.AUTH_APP_DB_PASSWORD ?? "postgres",
  WORKER_ROLE_CONTRACT_REQUIRED: "true",
});

const authRoleEnv = stripRoleContractEnv({
  ...baseEnv,
  DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER ?? databaseUrl,
  DATABASE_URL_AUTH:
    process.env.DATABASE_URL_AUTH ?? "postgresql://auth_app:postgres@localhost:5432/auction_ci",
  DATABASE_URL_API:
    process.env.DATABASE_URL_API ?? "postgresql://api_app:postgres@localhost:5432/auction_ci",
  DATABASE_URL_SHOP:
    process.env.DATABASE_URL_SHOP ?? "postgresql://shop_app:postgres@localhost:5432/auction_ci",
  WORKER_APP_DB_PASSWORD: process.env.WORKER_APP_DB_PASSWORD ?? "postgres",
  API_APP_DB_PASSWORD: process.env.API_APP_DB_PASSWORD ?? "postgres",
  AUTH_APP_DB_PASSWORD: process.env.AUTH_APP_DB_PASSWORD ?? "postgres",
  SHOP_APP_DB_PASSWORD: process.env.SHOP_APP_DB_PASSWORD ?? "postgres",
  AUTH_ROLE_CONTRACT_REQUIRED: "true",
});

function run(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);
  const attempts = options.attempts ?? 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) {
      console.log(`Retrying ${label} (${attempt}/${attempts})...`);
    }
    const result = spawnSync(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      env: options.env ?? baseEnv,
      shell: options.shell ?? false,
    });
    if (result.status === 0) return;
    if (attempt === attempts) {
      console.error(`\nFAILED: ${label}`);
      process.exit(result.status ?? 1);
    }
  }
}

function requireBinary(name) {
  const result = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(`${name} is required for local PR CI parity (${labelHint(name)})`);
    process.exit(1);
  }
}

function labelHint(name) {
  if (name === "gitleaks") return "brew install gitleaks";
  return "install and retry";
}

requireBinary("gitleaks");

run("Install", "pnpm", ["install", "--frozen-lockfile"]);

run("Biome", "pnpm", ["exec", "biome", "check", "."]);
run("Queue registry", "node", ["scripts/lint-queue-registry.mjs"]);
run("Gitleaks", "gitleaks", ["detect", "--source", ".", "--verbose", "--redact"]);
run("UI guardrails", "pnpm", ["lint:ui-guardrails"]);
run("Admin capability drift", "pnpm", ["lint:admin-capability-drift"]);
run("Web guardrails", "pnpm", ["lint:web-guardrails"]);
run("Admin lib boundaries", "pnpm", ["lint:lib-admin-boundaries"]);
run("Staff UI guardrails", "pnpm", ["lint:staff-legacy-shell"]);
run("Staff route composition", "pnpm", ["lint:staff-route-composition"]);
run("E2E portfolio guard", "pnpm", ["lint:e2e-portfolio"]);
run("E2E tag guard", "pnpm", ["lint:e2e-tags"]);
run("Zod schema transform lint", "pnpm", ["lint:z-schema-transform"]);
run("Turbo lint (affected)", "pnpm", ["turbo", "run", "lint", "--affected"]);
run("Dependency graph", "pnpm", ["lint:deps"]);
run("Package layers", "node", ["scripts/check-layers.mjs"]);
run("API route DIP coverage", "node", ["apps/api/scripts/check-route-dip-coverage.mjs"]);
run("Turbo typecheck (affected)", "pnpm", ["turbo", "run", "typecheck", "--affected"]);

run("Ensure CI database", "node", ["scripts/ci/ensure-ci-database.mjs"]);
run("DB migrate", "pnpm", ["--filter", "@auction/db", "db:migrate"]);
for (const tag of [
  "0137_identity_boundary_profiles",
  "0138_identity_boundary_clients",
  "0139_identity_lifecycle",
  "0140_bid_profile_authoritative",
  "0141_repair_sale_hero_presentation",
  "0142_bid_identity_lifecycle_projection",
  "0143_oauth_consent_client_user_unique",
  "0144_oidc_rp_sessions",
  "0145_oidc_logout_and_shop_sessions",
  "0146_ssf_signal_transport",
]) {
  run(`Migration pair ${tag}`, "pnpm", [
    "--filter",
    "@auction/db",
    "db:verify-migration-pair",
    tag,
  ]);
}

run("Identity boundary conformance", "pnpm", ["ci:identity-boundary"]);
run("Turbo test (affected)", "pnpm", ["turbo", "run", "test", "--affected"]);
run("Runtime ownership smoke gates", "pnpm", ["--filter", "@auction/types", "build"]);
run("Background runtime build", "pnpm", ["--filter", "@auction/background-runtime", "build"]);
run("Runtime ownership smoke", "node", ["scripts/ci/run-runtime-ownership-smoke-gates.mjs"], {
  attempts: 2,
});
run("Domain event smoke gates", "node", ["scripts/ci/run-domain-event-smoke-gates.mjs"]);
run("Cutover readiness defaults", "node", ["scripts/ci/verify-cutover-readiness.mjs"]);

run("Build db dependencies", "pnpm", ["--filter", "@auction/db...", "build"], {
  env: workerRoleEnv,
});
run(
  "Seed worker role contract probes",
  "pnpm",
  ["--filter", "@auction/db", "exec", "tsx", "scripts/seed-worker-role-contract-probes.ts"],
  { env: workerRoleEnv },
);
run("Apply application role grants (worker)", "pnpm", ["--filter", "@auction/db", "db:roles"], {
  env: workerRoleEnv,
});
run(
  "Worker app role contract",
  "pnpm",
  ["--filter", "@auction/db", "test", "--", "worker-app-role"],
  { env: workerRoleEnv },
);
run("Apply application role grants (auth)", "pnpm", ["--filter", "@auction/db", "db:roles"], {
  env: authRoleEnv,
});
run(
  "Auth/API/Shop role contracts",
  "pnpm",
  [
    "--filter",
    "@auction/db",
    "exec",
    "sh",
    "-c",
    "pnpm test:auth-role-contract && pnpm test:api-role-contract && pnpm test:shop-role-contract",
  ],
  { env: authRoleEnv },
);

run("Turbo build (affected)", "pnpm", ["turbo", "run", "build", "--affected"]);

if (withBrowserBuild) {
  run("Browser gate builds", "pnpm", ["--filter", "@auction/api...", "build"]);
  run("Browser gate auth build", "pnpm", ["--filter", "@auction/auth-app...", "build"]);
  run("Browser gate shop build", "pnpm", ["--filter", "@auction/shop-identity...", "build"]);
  run("Browser gate web build", "pnpm", ["--filter", "@auction/web...", "build"]);
}

console.log("\nLocal PR CI passed.");
if (!withBrowserBuild) {
  console.log("Tip: run with --with-browser-build to compile the browser-gates stack locally.");
}
