#!/usr/bin/env node
/**
 * Align identity_lifecycle_outbox_relay cursor with the latest outbox id (read-only by default).
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/db/src/ssl.js";

const PROJECTOR = "identity_lifecycle_outbox_relay";

async function main() {
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  try {
    await client.connect();
    const maxRow = await client.query(
      "SELECT coalesce(max(id), 0)::bigint AS max_id FROM identity_lifecycle_outbox",
    );
    const targetCursor = Number(maxRow.rows[0]?.max_id ?? 0);
    const current = await client.query(
      "SELECT last_processed_event_id FROM projector_state WHERE projector_name = $1",
      [PROJECTOR],
    );
    const currentCursor = Number(current.rows[0]?.last_processed_event_id ?? -1);
    console.log(
      JSON.stringify({ projector: PROJECTOR, currentCursor, targetCursor, apply }, null, 2),
    );
    if (!apply) {
      console.log("Dry run only; pass --apply to update projector_state.");
      return;
    }
    if (current.rows.length === 0) {
      await client.query(
        `
      INSERT INTO projector_state (projector_name, last_processed_event_id, updated_at, last_error)
      VALUES ($1, $2, now(), null)
    `,
        [PROJECTOR, targetCursor],
      );
    } else {
      await client.query(
        `
      UPDATE projector_state
      SET last_processed_event_id = $2, updated_at = now(), last_error = null
      WHERE projector_name = $1
    `,
        [PROJECTOR, targetCursor],
      );
    }
    console.log(`Updated ${PROJECTOR} cursor to ${targetCursor}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
