#!/usr/bin/env node
/**
 * Terminate worker_app sessions stuck in idle-in-transaction or long lock waits.
 * These block domain-event projector ticks (Zoho/Xero delivery enqueue deadlocks).
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const MIN_IDLE_IN_TX_SEC = Number(process.env.WORKER_BLOCKER_MIN_IDLE_SEC ?? 60);
const MIN_LOCK_WAIT_SEC = Number(process.env.WORKER_BLOCKER_MIN_LOCK_SEC ?? 30);

async function main() {
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    const candidates = await client.query(
      `
      SELECT
        pid,
        usename,
        state,
        wait_event_type,
        extract(epoch FROM (clock_timestamp() - query_start))::integer AS query_age_sec,
        left(query, 160) AS query_preview
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND usename = 'worker_app'
        AND (
          (state = 'idle in transaction' AND extract(epoch FROM (clock_timestamp() - state_change)) >= $1)
          OR (
            state = 'active'
            AND wait_event_type = 'Lock'
            AND extract(epoch FROM (clock_timestamp() - query_start)) >= $2
          )
        )
      ORDER BY query_age_sec DESC
    `,
      [MIN_IDLE_IN_TX_SEC, MIN_LOCK_WAIT_SEC],
    );

    console.log(
      JSON.stringify(
        {
          apply,
          candidateCount: candidates.rows.length,
          candidates: candidates.rows,
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log("Dry run only; pass --apply to pg_terminate_backend on candidates.");
      return;
    }

    const terminated = [];
    for (const row of candidates.rows) {
      const result = await client.query("SELECT pg_terminate_backend($1::integer) AS ok", [row.pid]);
      terminated.push({ pid: row.pid, ok: result.rows[0]?.ok === true });
    }
    console.log(JSON.stringify({ terminated }, null, 2));
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
