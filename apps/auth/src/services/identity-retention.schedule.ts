import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";

export const IDENTITY_RETENTION_INTERVAL_MS = 15 * 60_000;
export const IDENTITY_RETENTION_BATCH_SIZE = 500;
export const OIDC_RP_SESSION_RETENTION_DAYS = 30;
export const DELIVERED_SIGNAL_RETENTION_DAYS = 30;
export const FAILED_SIGNAL_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60_000;

export async function purgeIdentityRetentionBatch(
  db: Pick<Database, "execute">,
  now: Date = new Date(),
): Promise<void> {
  const rpCutoff = new Date(now.getTime() - OIDC_RP_SESSION_RETENTION_DAYS * DAY_MS);
  const deliveredCutoff = new Date(now.getTime() - DELIVERED_SIGNAL_RETENTION_DAYS * DAY_MS);
  const failedCutoff = new Date(now.getTime() - FAILED_SIGNAL_RETENTION_DAYS * DAY_MS);

  await db.execute(sql`
    WITH candidates AS (
      SELECT "client_id", "sid"
      FROM "oidc_rp_session"
      WHERE ("revoked_at" IS NOT NULL AND "revoked_at" < ${rpCutoff})
         OR ("revoked_at" IS NULL AND "last_seen_at" < ${rpCutoff})
      ORDER BY coalesce("revoked_at", "last_seen_at"), "client_id", "sid"
      LIMIT ${IDENTITY_RETENTION_BATCH_SIZE}
    )
    DELETE FROM "oidc_rp_session" AS target
    USING candidates
    WHERE target."client_id" = candidates."client_id"
      AND target."sid" = candidates."sid"
  `);
  await db.execute(sql`
    WITH candidates AS (
      SELECT "id"
      FROM "oidc_backchannel_logout_delivery"
      WHERE ("status" = 'delivered' AND "updated_at" < ${deliveredCutoff})
         OR ("status" = 'failed' AND "updated_at" < ${failedCutoff})
      ORDER BY "updated_at", "id"
      LIMIT ${IDENTITY_RETENTION_BATCH_SIZE}
    )
    DELETE FROM "oidc_backchannel_logout_delivery" AS target
    USING candidates
    WHERE target."id" = candidates."id"
  `);
  await db.execute(sql`
    WITH candidates AS (
      SELECT "id"
      FROM "ssf_delivery"
      WHERE ("status" = 'delivered' AND "updated_at" < ${deliveredCutoff})
         OR ("status" = 'failed' AND "updated_at" < ${failedCutoff})
      ORDER BY "updated_at", "id"
      LIMIT ${IDENTITY_RETENTION_BATCH_SIZE}
    )
    DELETE FROM "ssf_delivery" AS target
    USING candidates
    WHERE target."id" = candidates."id"
  `);
}

export function startIdentityRetentionSchedule(options: {
  db: Pick<Database, "execute">;
  onError: (error: unknown) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = purgeIdentityRetentionBatch(options.db)
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? IDENTITY_RETENTION_INTERVAL_MS);
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
