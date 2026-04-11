import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root `.env`, then `packages/db/.env` (later file overrides). */
export function loadEnvFiles(): void {
  const rootEnv = resolve(__dirname, "../../../.env");
  const pkgEnv = resolve(__dirname, "../.env");
  if (existsSync(rootEnv)) {
    config({ path: rootEnv });
  }
  if (existsSync(pkgEnv)) {
    config({ path: pkgEnv });
  }
}
