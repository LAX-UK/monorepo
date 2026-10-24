import { ACCOUNT_DELETION_GRACE_DAYS } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { sql } from "drizzle-orm";

export const IDENTITY_DELETION_PURGE_INTERVAL_MS = 24 * 60 * 60_000;
/** The same number LAX Account tells people, so the promise and the purge cannot drift apart. */
export const IDENTITY_DELETION_GRACE_DAYS = ACCOUNT_DELETION_GRACE_DAYS;
export const IDENTITY_DELETION_PURGE_BATCH_SIZE = 100;

const DAY_MS = 24 * 60 * 60_000;

/**
 * Erases one batch of people whose grace period has ended and returns their ids. The SQL scrub
 * deletes their sessions, credentials and tokens; the caller then ends what still lives outside
 * the scrub (relying-party sessions, back-channel logout) for each id.
 */
export async function purgeDeletedSubjectsBatch(
  db: Pick<IdentityDatabase, "execute">,
  now: Date = new Date(),
): Promise<string[]> {
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
    RETURNING "aggregate_id" AS "id"
  `);
  return result.rows.map((row) => String((row as { id: unknown }).id));
}

export function startIdentityDeletionPurgeSchedule(options: {
  db: Pick<IdentityDatabase, "execute">;
  onError: (error: unknown) => void;
  onPurged?: (count: number) => void;
  /**
   * Ends the person's relying-party sessions and tells every product to sign them out. Must not
   * throw: a failure has to be retried from a durable queue, not lost with the batch.
   */
  endSessions?: (subjectId: string) => Promise<void>;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = purgeDeletedSubjectsBatch(options.db)
      .then(async (subjectIds) => {
        for (const subjectId of subjectIds) await options.endSessions?.(subjectId);
        if (subjectIds.length > 0) options.onPurged?.(subjectIds.length);
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
