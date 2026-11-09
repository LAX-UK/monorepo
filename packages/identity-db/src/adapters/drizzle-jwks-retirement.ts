import { ACCESS_TOKEN_TTL_SECONDS, DISCOVERY_CACHE_TTL_MS } from "@auction/identity-contracts";
import { and, eq, lt, sql } from "drizzle-orm";
import { jwksKey } from "../schema/jwks-key.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";

const SAFETY_MARGIN_MS = 15 * 60 * 1000;

/**
 * A rotating key stays published until every token it signed has expired and
 * every consumer has refreshed its JWKS cache, plus a safety margin. Derived
 * from the access-token lifetime so a longer lifetime widens the window.
 */
export const JWKS_RETIREMENT_WINDOW_MS =
  Math.max(DISCOVERY_CACHE_TTL_MS, ACCESS_TOKEN_TTL_SECONDS * 1000) + SAFETY_MARGIN_MS;

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
/** Serialises key retirement ticks and key rotation. */
export const JWKS_ADVISORY_LOCK_KEY = 0x4a574b5f52455452n;
const DEFAULT_LOCK_KEY = JWKS_ADVISORY_LOCK_KEY;

type Logger = {
  info: (bindings: Record<string, unknown>, message: string) => void;
  error: (bindings: Record<string, unknown>, message: string) => void;
  debug?: (bindings: Record<string, unknown>, message: string) => void;
};

type LockRow = {
  lock_acquired?: boolean;
  pg_try_advisory_xact_lock?: boolean;
};

type ScheduleOptions = {
  db: IdentityDatabase;
  log: Logger;
  intervalMs?: number;
  lockKey?: bigint;
};

function rowsFromExecuteResult(result: unknown): LockRow[] {
  if (Array.isArray(result)) return result as LockRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: LockRow[] }).rows ?? [];
  }
  return [];
}

export async function retireExpiredJwksKeys(db: IdentityDatabase, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - JWKS_RETIREMENT_WINDOW_MS);
  await db
    .update(jwksKey)
    .set({ status: "retired" })
    .where(and(eq(jwksKey.status, "rotating"), lt(jwksKey.rotatedAt, cutoff)));
}

export function startJwksRetirementSchedule(options: ScheduleOptions): { stop: () => void } {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const lockKey = (options.lockKey ?? DEFAULT_LOCK_KEY).toString();
  let running = false;

  async function tick() {
    if (running) return;
    running = true;

    try {
      await options.db.transaction(async (tx) => {
        const lockResult = await tx.execute(
          sql`select pg_try_advisory_xact_lock(${lockKey}::bigint) as lock_acquired`,
        );
        const lockAcquired = Boolean(rowsFromExecuteResult(lockResult)[0]?.lock_acquired);
        if (!lockAcquired) {
          options.log.debug?.({ lockKey }, "jwks_retirement_tick_skipped");
          return;
        }

        await retireExpiredJwksKeys(tx);
        options.log.info({ lockKey }, "jwks_retirement_tick");
      });
    } catch (err) {
      options.log.error({ err }, "jwks_retirement_tick_failed");
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref();

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
