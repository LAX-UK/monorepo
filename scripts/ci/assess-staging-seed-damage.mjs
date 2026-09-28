#!/usr/bin/env node
/**
 * Read-only row counts for tables touched by the destructive dev seed clearAll().
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/db/src/ssl.js";

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
    const dupes = await client.query(
      `
    SELECT event_type, count(*)::integer AS count
    FROM domain_events
    WHERE occurred_at >= $1::timestamptz
    GROUP BY event_type
    ORDER BY count DESC
  `,
      [dupesSince],
    );
    console.log(
      JSON.stringify(
        {
          counts,
          relay: relay.rows[0] ?? null,
          maxOutboxId: maxOutbox.rows[0]?.max_id,
          dupesSince,
          domainEventsSince: dupes.rows,
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
