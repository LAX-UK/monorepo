#!/usr/bin/env node
/**
 * Read-only row counts for tables touched by the destructive dev seed clearAll().
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

/** Drizzle journal `when` for 0180_crm_record_link_subject_id */
const CRM_MIGRATION_THROUGH_MILLIS = 1790928000000;

async function main() {
  const databaseUrl = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const tables = [
    "saleroom_event",
    "saleroom_session",
    "projector_state",
    "domain_events",
    "email_event",
    "email_outbox",
    "jwks_key",
    "user",
    "session",
    "crm_record_link",
  ];

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  try {
    await client.connect();
    const counts = {};
    for (const table of tables) {
      const result = await client.query(`SELECT count(*)::bigint AS count FROM ${table}`);
      counts[table] = Number(result.rows[0]?.count ?? 0);
    }
    const relay = await client.query(`
    SELECT last_processed_event_id, updated_at
    FROM projector_state
    WHERE projector_name = 'identity_lifecycle_outbox_relay'
  `);
    const maxOutbox = await client.query(
      "SELECT coalesce(max(id), 0)::bigint AS max_id FROM identity_lifecycle_outbox",
    );
    const dupesSince = process.env.ASSESS_SINCE_ISO ?? "2026-09-28T11:40:00Z";
    const eventsSince = await client.query(
      `
    SELECT event_type, count(*)::integer AS count
    FROM domain_events
    WHERE occurred_at >= $1::timestamptz
    GROUP BY event_type
    ORDER BY count DESC
  `,
      [dupesSince],
    );
    const duplicateCandidates = await client.query(
      `
    SELECT event_type, aggregate_type, aggregate_id, count(*)::integer AS count
    FROM domain_events
    WHERE occurred_at >= $1::timestamptz
    GROUP BY event_type, aggregate_type, aggregate_id
    HAVING count(*) > 1
    ORDER BY count DESC
    LIMIT 50
  `,
      [dupesSince],
    );
    const exactDuplicates = await client.query(`
    SELECT event_type, aggregate_type, aggregate_id, occurred_at, count(*)::integer AS count
    FROM domain_events
    GROUP BY event_type, aggregate_type, aggregate_id, occurred_at, payload
    HAVING count(*) > 1
    ORDER BY count DESC
    LIMIT 50
  `);
    const emailOutboxSince = await client.query(
      `
    SELECT count(*)::integer AS count
    FROM email_outbox
    WHERE created_at >= $1::timestamptz
  `,
      [dupesSince],
    );
    const activity = await client.query(`
    SELECT
      pid,
      usename,
      state,
      wait_event_type,
      extract(epoch FROM (clock_timestamp() - state_change))::integer AS state_age_sec,
      left(query, 80) AS query_preview
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND backend_type = 'client backend'
      AND pid <> pg_backend_pid()
    ORDER BY state_change
    LIMIT 30
  `);
    const deliverySince = await client.query(
      `
    SELECT consumer, status, count(*)::integer AS count
    FROM domain_event_delivery
    WHERE created_at >= $1::timestamptz
      AND consumer IN ('zoho', 'xero')
    GROUP BY consumer, status
    ORDER BY consumer, status
  `,
      [dupesSince],
    );
    const lastMigration = await client.query(
      "SELECT max(created_at)::bigint AS last_applied_folder_millis FROM drizzle.__drizzle_migrations",
    );
    const lastAppliedFolderMillis = Number(lastMigration.rows[0]?.last_applied_folder_millis ?? 0);
    const crmMigrationsThrough0180 = lastAppliedFolderMillis >= CRM_MIGRATION_THROUGH_MILLIS;

    console.log(
      JSON.stringify(
        {
          counts,
          relay: relay.rows[0] ?? null,
          maxOutboxId: maxOutbox.rows[0]?.max_id,
          dupesSince,
          domainEventsSince: eventsSince.rows,
          duplicateAggregateEventsSince: duplicateCandidates.rows,
          exactDuplicateDomainEvents: exactDuplicates.rows,
          emailOutboxCreatedSince: emailOutboxSince.rows[0]?.count ?? 0,
          pgStatActivity: activity.rows,
          domainEventDeliverySince: deliverySince.rows,
          lastAppliedFolderMillis,
          crmMigrationsThrough0180,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
