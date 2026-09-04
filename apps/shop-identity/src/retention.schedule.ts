import type { Pool } from "pg";

export const SHOP_RETENTION_INTERVAL_MS = 15 * 60_000;
export const SHOP_RETENTION_BATCH_SIZE = 500;
export const SHOP_SESSION_RETENTION_DAYS = 7;

export async function purgeShopRetentionBatch(
  pool: Pick<Pool, "query">,
  now: Date = new Date(),
): Promise<void> {
  const sessionCutoff = new Date(now.getTime() - SHOP_SESSION_RETENTION_DAYS * 24 * 60 * 60_000);
  await pool.query(
    `with candidates as (
       select id
         from shop_identity_session
        where expires_at < $1
        order by expires_at, id
        limit $2
     )
     delete from shop_identity_session as target
      using candidates
      where target.id = candidates.id`,
    [sessionCutoff, SHOP_RETENTION_BATCH_SIZE],
  );
  for (const table of ["shop_logout_token_replay", "shop_ssf_replay"] as const) {
    await pool.query(
      `with candidates as (
         select jti
           from ${table}
          where expires_at < $1
          order by expires_at, jti
          limit $2
       )
       delete from ${table} as target
        using candidates
        where target.jti = candidates.jti`,
      [now, SHOP_RETENTION_BATCH_SIZE],
    );
  }
}

export function startShopRetentionSchedule(options: {
  pool: Pick<Pool, "query">;
  onError: (error: unknown) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = purgeShopRetentionBatch(options.pool)
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? SHOP_RETENTION_INTERVAL_MS);
  timer.unref();
  run();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
  };
}
