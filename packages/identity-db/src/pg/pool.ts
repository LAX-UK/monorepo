import type { PoolConfig } from "pg";
import { buildPgConnectionConfig } from "./ssl.js";

/** Connections per process when `DATABASE_POOL_MAX` is unset or invalid. */
export const DEFAULT_POOL_MAX = 5;
/** Upper bound; a larger value is almost certainly a typo on a managed Postgres plan. */
export const MAX_POOL_MAX = 50;
export const POOL_IDLE_TIMEOUT_MS = 30_000;
export const POOL_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Read the per-process pool size from `DATABASE_POOL_MAX`.
 *
 * Total database connections = sum over services of (instances x pool size), so the
 * value is set per service in infrastructure. Unset, non-integer or non-positive input
 * falls back to the default; values above {@link MAX_POOL_MAX} are clamped.
 */
export function readPoolMax(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DATABASE_POOL_MAX?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_POOL_MAX;
  const parsed = Number(raw);
  if (parsed < 1) return DEFAULT_POOL_MAX;
  return Math.min(parsed, MAX_POOL_MAX);
}

/**
 * The single owner of pool policy: SSL, size, idle and connect timeouts. Every
 * `new pg.Pool(...)` is built from this.
 */
export function buildPgPoolConfig(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  return {
    ...buildPgConnectionConfig(connectionString),
    max: readPoolMax(env),
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
  };
}
