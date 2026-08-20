import type { IdentityDatabase } from "@auction/identity-db";
import { sql } from "drizzle-orm";

export const IDENTITY_DELETION_PURGE_INTERVAL_MS = 24 * 60 * 60_000;
export const IDENTITY_DELETION_GRACE_DAYS = 30;
export const IDENTITY_DELETION_PURGE_BATCH_SIZE = 100;

const DAY_MS = 24 * 60 * 60_000;

export async function purgeDeletedSubjectsBatch(
  db: Pick<IdentityDatabase, "execute">,
  now: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - IDENTITY_DELETION_GRACE_DAYS * DAY_MS);
  const result = await db.execute(sql`
    WITH candidates AS (
      SELECT "id"
      FROM "user"
      WHERE "deletion_requested_at" IS NOT NULL
        AND "deletion_requested_at" < ${cutoff}
        AND "email" <> 'deleted+' || "id" || '@purged.invalid'
      ORDER BY "deletion_requested_at", "id"
      LIMIT ${IDENTITY_DELETION_PURGE_BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    , purged AS (
      SELECT "id", user_pii_purge("id")
      FROM candidates
    )
    INSERT INTO identity_lifecycle_outbox (
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      producer,
      actor_user_id,
      schema_version,
      occurred_at
    )
    SELECT
      'user',
      "id",
      'user.identity_deleted',
      jsonb_build_object(
        'schemaVersion', 1,
        'subjectId', "id",
        'deletedAt', ${now}::timestamptz
      ),
      'apps/auth-deletion-purge',
      NULL,
      1,
      ${now}::timestamptz
    FROM purged
  `);
  return result.rowCount ?? 0;
}

export function startIdentityDeletionPurgeSchedule(options: {
  db: Pick<IdentityDatabase, "execute">;
  onError: (error: unknown) => void;
  onPurged?: (count: number) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = purgeDeletedSubjectsBatch(options.db)
      .then((count) => {
        if (count > 0) options.onPurged?.(count);
      })
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(run, options.intervalMs ?? IDENTITY_DELETION_PURGE_INTERVAL_MS);
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
