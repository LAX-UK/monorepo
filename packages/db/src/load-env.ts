import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root `.env`, then `packages/db/.env` (later file overrides). */
export function loadEnvFiles(): void {
  const rootEnv = resolve(__dirname, "../../../.env");
  const pkgEnv = resolve(__dirname, "../.env");
  // `override: true` so file wins over a stale `DATABASE_URL` exported in the shell (e.g. old :5432).
  if (existsSync(rootEnv)) {
    config({ path: rootEnv, override: true });
  }
  if (existsSync(pkgEnv)) {
    config({ path: pkgEnv, override: true });
  }
}

/**
 * Load `.env` only when `DATABASE_URL` is unset. Docker/Kubernetes (and `docker compose exec`)
 * inject `DATABASE_URL`; loading `.env` with `override` would replace it with a host-only URL
 * or wrong password and break `pnpm db:migrate:docker`.
 */
export function loadEnvFilesIfNeeded(): void {
  if (process.env.DATABASE_URL?.trim()) {
    return;
  }
  loadEnvFiles();
}
