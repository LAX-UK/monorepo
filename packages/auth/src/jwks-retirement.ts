import { type Database, jwksKey } from "@auction/db";
import { and, eq, lt, sql } from "drizzle-orm";

const RETIREMENT_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_LOCK_KEY = 0x4a574b5f52455452n;

type Logger = {
  info: (bindings: Record<string, unknown>, message: string) => void;
  error: (bindings: Record<string, unknown>, message: string) => void;
  debug?: (bindings: Record<string, unknown>, message: string) => void;
};

type LockRow = {
  lock_acquired?: boolean;
  pg_try_advisory_lock?: boolean;
};

type ScheduleOptions = {
  db: Database;
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

export async function retireExpiredJwksKeys(db: Database, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - RETIREMENT_WINDOW_MS);
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
          sql`select pg_try_advisory_lock(${lockKey}::bigint) as lock_acquired`,
        );
        const lockAcquired = Boolean(rowsFromExecuteResult(lockResult)[0]?.lock_acquired);
        if (!lockAcquired) {
          options.log.debug?.({ lockKey }, "jwks_retirement_tick_skipped");
          return;
        }

        try {
          await retireExpiredJwksKeys(tx);
          options.log.info({ lockKey }, "jwks_retirement_tick");
        } finally {
          await tx.execute(sql`select pg_advisory_unlock(${lockKey}::bigint)`);
        }
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
