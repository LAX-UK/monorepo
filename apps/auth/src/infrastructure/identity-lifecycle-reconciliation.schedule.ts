import type { IdentityDatabase } from "@auction/identity-db";
import { sql } from "drizzle-orm";

export const IDENTITY_LIFECYCLE_RECONCILIATION_INTERVAL_MS = 60_000;
export const IDENTITY_LIFECYCLE_RECONCILIATION_BATCH_SIZE = 500;
export const IDENTITY_LIFECYCLE_RECONCILIATION_LOCK_KEY = 4_803_971_421n;

export type IdentityLifecycleReconciliationCounts = {
  registered: number;
  emailVerified: number;
  profileUpdated: number;
  credentialChanged: number;
};

function rowCount(result: { rowCount?: number | null }): number {
  return result.rowCount ?? 0;
}

export async function reconcileIdentityLifecycleOutbox(
  db: IdentityDatabase,
  now = new Date(),
  batchSize = IDENTITY_LIFECYCLE_RECONCILIATION_BATCH_SIZE,
): Promise<IdentityLifecycleReconciliationCounts> {
  return db.transaction(async (transaction) => {
    const lock = await transaction.execute(sql`
      SELECT pg_try_advisory_xact_lock(
        ${IDENTITY_LIFECYCLE_RECONCILIATION_LOCK_KEY.toString()}::bigint
      ) AS lock_acquired
    `);
    if (!(lock.rows[0] as { lock_acquired?: boolean } | undefined)?.lock_acquired) {
      return { registered: 0, emailVerified: 0, profileUpdated: 0, credentialChanged: 0 };
    }

    const registered = await transaction.execute(sql`
      WITH candidates AS (
        SELECT
          users."id",
          users."email",
          users."name",
          users."image",
          users."phone_number",
          users."email_verified",
          users."created_at",
          CASE lower(first_account."provider_id")
            WHEN 'google' THEN 'google'
            WHEN 'apple' THEN 'apple'
            ELSE 'credential'
          END AS source
        FROM "user" AS users
        JOIN LATERAL (
          SELECT accounts."provider_id"
          FROM "account" AS accounts
          WHERE accounts."user_id" = users."id"
          ORDER BY accounts."created_at", accounts."id"
          LIMIT 1
        ) AS first_account ON true
        WHERE NOT EXISTS (
          SELECT 1
          FROM "identity_lifecycle_outbox" AS outbox
          WHERE outbox."aggregate_type" = 'user'
            AND outbox."aggregate_id" = users."id"
            AND outbox."event_type" = 'user.registered'
        )
        ORDER BY users."created_at", users."id"
        LIMIT ${batchSize}
      )
      INSERT INTO "identity_lifecycle_outbox" (
        "aggregate_type",
        "aggregate_id",
        "event_type",
        "payload",
        "producer",
        "actor_user_id",
        "schema_version",
        "occurred_at"
      )
      SELECT
        'user',
        candidates."id",
        'user.registered',
        jsonb_strip_nulls(jsonb_build_object(
          'userId', candidates."id",
          'email', candidates."email",
          'name', candidates."name",
          'source', candidates.source,
          'image', candidates."image",
          'phone', candidates."phone_number",
          'emailVerified', candidates."email_verified",
          'createdAt', candidates."created_at"
        )),
        'apps/auth-reconciliation',
        NULL,
        1,
        ${now}
      FROM candidates
      ON CONFLICT DO NOTHING
    `);

    const emailVerified = await transaction.execute(sql`
      WITH candidates AS (
        SELECT users."id", users."email"
        FROM "user" AS users
        WHERE users."email_verified" = true
          AND NOT EXISTS (
            SELECT 1
            FROM "identity_lifecycle_outbox" AS outbox
            WHERE outbox."aggregate_type" = 'user'
              AND outbox."aggregate_id" = users."id"
              AND outbox."event_type" = 'user.email_verified'
          )
        ORDER BY users."updated_at", users."id"
        LIMIT ${batchSize}
      )
      INSERT INTO "identity_lifecycle_outbox" (
        "aggregate_type",
        "aggregate_id",
        "event_type",
        "payload",
        "producer",
        "actor_user_id",
        "schema_version",
        "occurred_at"
      )
      SELECT
        'user',
        candidates."id",
        'user.email_verified',
        jsonb_build_object(
          'userId', candidates."id",
          'email', candidates."email",
          'verifiedAt', ${now}::timestamptz
        ),
        'apps/auth-reconciliation',
        candidates."id",
        1,
        ${now}::timestamptz
      FROM candidates
      ON CONFLICT DO NOTHING
    `);

    const profileUpdated = await transaction.execute(sql`
      WITH candidates AS (
        SELECT
          users."id",
          users."email",
          users."name",
          users."image",
          users."phone_number",
          users."updated_at"
        FROM "user" AS users
        WHERE users."updated_at" > users."created_at"
          AND NOT EXISTS (
            SELECT 1
            FROM "identity_lifecycle_outbox" AS outbox
            WHERE outbox."aggregate_type" = 'user'
              AND outbox."aggregate_id" = users."id"
              AND outbox."event_type" = 'user.profile_updated'
              AND outbox."occurred_at" >= users."updated_at"
          )
        ORDER BY users."updated_at", users."id"
        LIMIT ${batchSize}
      )
      INSERT INTO "identity_lifecycle_outbox" (
        "aggregate_type",
        "aggregate_id",
        "event_type",
        "payload",
        "producer",
        "actor_user_id",
        "schema_version",
        "occurred_at"
      )
      SELECT
        'user',
        candidates."id",
        'user.profile_updated',
        jsonb_build_object(
          'schemaVersion', 1,
          'subjectId', candidates."id",
          'email', candidates."email",
          'name', candidates."name",
          'phone', candidates."phone_number",
          'image', candidates."image",
          'updatedAt', candidates."updated_at"
        ),
        'apps/auth-reconciliation',
        NULL,
        1,
        ${now}
      FROM candidates
    `);

    const credentialChanged = await transaction.execute(sql`
      WITH candidates AS (
        SELECT accounts."user_id", accounts."updated_at"
        FROM "account" AS accounts
        WHERE accounts."provider_id" = 'credential'
          AND accounts."password" IS NOT NULL
          AND accounts."updated_at" > accounts."created_at"
          AND NOT EXISTS (
            SELECT 1
            FROM "identity_lifecycle_outbox" AS outbox
            WHERE outbox."aggregate_type" = 'user'
              AND outbox."aggregate_id" = accounts."user_id"
              AND outbox."event_type" = 'user.credential_changed'
              AND outbox."occurred_at" >= accounts."updated_at"
          )
        ORDER BY accounts."updated_at", accounts."user_id"
        LIMIT ${batchSize}
      )
      INSERT INTO "identity_lifecycle_outbox" (
        "aggregate_type",
        "aggregate_id",
        "event_type",
        "payload",
        "producer",
        "actor_user_id",
        "schema_version",
        "occurred_at"
      )
      SELECT
        'user',
        candidates."user_id",
        'user.credential_changed',
        jsonb_build_object(
          'schemaVersion', 1,
          'subjectId', candidates."user_id",
          'credentialType', 'password',
          'changeType', 'update',
          'changedAt', candidates."updated_at"
        ),
        'apps/auth-reconciliation',
        NULL,
        1,
        ${now}
      FROM candidates
    `);

    return {
      registered: rowCount(registered),
      emailVerified: rowCount(emailVerified),
      profileUpdated: rowCount(profileUpdated),
      credentialChanged: rowCount(credentialChanged),
    };
  });
}

export function startIdentityLifecycleReconciliationSchedule(options: {
  db: IdentityDatabase;
  onError: (error: unknown) => void;
  onReconciled?: (counts: IdentityLifecycleReconciliationCounts) => void;
  intervalMs?: number;
}): { stop: () => Promise<void> } {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  const run = () => {
    if (stopped || inFlight) return;
    inFlight = reconcileIdentityLifecycleOutbox(options.db)
      .then((counts) => {
        if (
          counts.registered +
            counts.emailVerified +
            counts.profileUpdated +
            counts.credentialChanged >
          0
        ) {
          options.onReconciled?.(counts);
        }
      })
      .catch(options.onError)
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(
    run,
    options.intervalMs ?? IDENTITY_LIFECYCLE_RECONCILIATION_INTERVAL_MS,
  );
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
