import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";

export const BID_SSF_RETENTION_INTERVAL_MS = 15 * 60_000;
export const BID_SSF_RETENTION_BATCH_SIZE = 500;

export async function purgeBidSsfReplayBatch(
  db: Pick<Database, "execute">,
  now: Date = new Date(),
): Promise<void> {
  await db.execute(sql`
    WITH candidates AS (
      SELECT "jti"
      FROM "bid_ssf_replay"
      WHERE "expires_at" < ${now}
      ORDER BY "expires_at", "jti"
      LIMIT ${BID_SSF_RETENTION_BATCH_SIZE}
    )
    DELETE FROM "bid_ssf_replay" AS target
    USING candidates
    WHERE target."jti" = candidates."jti"
  `);
}

export function startBidSsfRetentionSchedule(options: {
  db: Pick<Database, "execute">;
  onError: (error: unknown) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = purgeBidSsfReplayBatch(options.db)
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? BID_SSF_RETENTION_INTERVAL_MS);
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
