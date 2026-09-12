#!/usr/bin/env node
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const databaseUrl = process.env.DATABASE_URL_OWNER;
const maxAgeMs = Number(process.env.IDENTITY_OUTBOX_MAX_AGE_MS);

if (!databaseUrl) throw new Error("DATABASE_URL_OWNER is required");
if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
  throw new Error("IDENTITY_OUTBOX_MAX_AGE_MS must be an approved positive numeric threshold");
}

const client = new pg.Client(buildPgConnectionConfig(databaseUrl));

try {
  await client.connect();
  const result = await client.query(`
    SELECT
      count(*)::integer AS pending_count,
      coalesce(
        extract(epoch FROM (clock_timestamp() - min(outbox.occurred_at))) * 1000,
        0
      )::bigint AS oldest_pending_ms
    FROM identity_lifecycle_outbox AS outbox
    WHERE outbox.id > coalesce(
      (
        SELECT last_processed_event_id
        FROM projector_state
        WHERE projector_name = 'identity_lifecycle_outbox_relay'
      ),
      0
    )
  `);
  const pendingCount = Number(result.rows[0]?.pending_count ?? 0);
  const oldestPendingMs = Number(result.rows[0]?.oldest_pending_ms ?? 0);
  if (oldestPendingMs > maxAgeMs) {
    throw new Error(
      `Identity lifecycle outbox lag ${oldestPendingMs}ms exceeds ${maxAgeMs}ms ` +
        `(${pendingCount} pending events)`,
    );
  }
  console.log(
    JSON.stringify({
      pendingCount,
      oldestPendingMs,
      thresholdMs: maxAgeMs,
      checkedAt: new Date().toISOString(),
    }),
  );
} finally {
  await client.end().catch(() => undefined);
}
