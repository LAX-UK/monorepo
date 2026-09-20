#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(root, ".env");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function requireEnv(name, env) {
  const value = process.env[name]?.trim() || env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name} — copy .env.example and set Shop Identity secrets (≥32 chars).`,
    );
  }
  return value;
}

async function main() {
  const fileEnv = loadEnvFile(envPath);
  const databaseUrl = requireEnv("DATABASE_URL", fileEnv);
  requireEnv("OIDC_CLIENT_SECRET", fileEnv);
  requireEnv("SESSION_SECRET", fileEnv);
  requireEnv("OIDC_ISSUER_URL", fileEnv);

  console.warn("Ensure Postgres and Redis are up: docker compose up -d postgres redis");

  const oidcSecret = process.env.OIDC_CLIENT_SECRET?.trim() || fileEnv.OIDC_CLIENT_SECRET?.trim();
  const configure = spawnSync("pnpm", ["--filter", "@auction/db", "db:configure-oidc-clients"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER ?? databaseUrl,
      OIDC_CLIENT_IDS: "lax-shop-web",
      OIDC_CLIENT_SECRET_LAX_SHOP_WEB: oidcSecret,
    },
  });
  if (configure.status !== 0) {
    throw new Error(
      "OIDC client provisioning failed — run pnpm db:migrate first if schema is empty.",
    );
  }

  console.log("Shop auth preflight passed (secrets present, lax-shop-web provisioned).");
  console.log("Start stack: pnpm dev:shop");
  console.log("Test OIDC:   pnpm shop:auth:test (requires auth + shop-identity running)");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
