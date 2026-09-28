#!/usr/bin/env node
/**
 * Restore staging projector_state cursors after a destructive seed wipe (dry run by default).
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";
import {
  DOMAIN_EVENT_PROJECTOR_NAMES,
  IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR,
} from "./worker-projector-names.mjs";

const DEFAULT_DOMAIN_EVENT_CUTOFF = "2026-09-28T13:36:32Z";
const DEFAULT_RELAY_CUTOFF = "2026-09-28T11:21:44Z";

function parseArgs(argv) {
  let apply = false;
  let domainEventCutoff = process.env.DOMAIN_EVENT_CUTOFF ?? DEFAULT_DOMAIN_EVENT_CUTOFF;
  let relayCutoff = process.env.RELAY_CUTOFF ?? DEFAULT_RELAY_CUTOFF;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--domain-event-cutoff") {
      domainEventCutoff = argv[index + 1] ?? domainEventCutoff;
      index += 1;
      continue;
    }
    if (arg === "--relay-cutoff") {
      relayCutoff = argv[index + 1] ?? relayCutoff;
      index += 1;
    }
  }
  return { apply, domainEventCutoff, relayCutoff };
}

async function resolveTargets(client, domainEventCutoff, relayCutoff) {
  const domainMax = await client.query(
    `
    SELECT coalesce(max(id), 0)::bigint AS max_id
    FROM domain_events
    WHERE occurred_at < $1::timestamptz
  `,
    [domainEventCutoff],
  );
  const relayMax = await client.query(
    `
    SELECT coalesce(max(id), 0)::bigint AS max_id
    FROM identity_lifecycle_outbox
    WHERE occurred_at < $1::timestamptz
  `,
    [relayCutoff],
  );
  const domainTarget = Number(domainMax.rows[0]?.max_id ?? 0);
  const relayTarget = Number(relayMax.rows[0]?.max_id ?? 0);
  const targets = {};
  for (const name of DOMAIN_EVENT_PROJECTOR_NAMES) {
    targets[name] = domainTarget;
  }
  targets[IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR] = relayTarget;
  return { targets, domainTarget, relayTarget, domainEventCutoff, relayCutoff };
}

async function readCurrentCursors(client) {
  const result = await client.query(
    "SELECT projector_name, last_processed_event_id FROM projector_state ORDER BY projector_name",
  );
  return Object.fromEntries(
    result.rows.map((row) => [row.projector_name, Number(row.last_processed_event_id ?? 0)]),
  );
}

async function terminateBlockers(client, ownPid) {
  const candidates = await client.query(`
    SELECT
      pid,
      usename,
      state,
      wait_event_type,
      extract(epoch FROM (clock_timestamp() - state_change))::integer AS state_age_sec,
      left(query, 120) AS query_preview
    FROM pg_stat_activity
    WHERE pid <> $1
      AND datname = current_database()
      AND backend_type = 'client backend'
  `, [ownPid]);

  const terminated = [];
  for (const row of candidates.rows) {
    const query = String(row.query_preview ?? "").toLowerCase();
    const age = Number(row.state_age_sec ?? 0);
    const isSeedDelete =
      query.startsWith('delete from "') || query.startsWith("delete from domain_events");
    const isLongLockWait =
      row.wait_event_type === "Lock" && age >= 60;
    if ((isSeedDelete && age >= 60) || isLongLockWait) {
      const term = await client.query("SELECT pg_terminate_backend($1::integer) AS ok", [
        row.pid,
      ]);
      if (term.rows[0]?.ok) {
        terminated.push({
          pid: row.pid,
          usename: row.usename,
          reason: isSeedDelete ? "seed_delete" : "lock_wait",
          queryPreview: row.query_preview,
        });
      }
    }
  }
  return terminated;
}

async function upsertCursors(client, targets) {
  const updated = [];
  for (const [projectorName, targetCursor] of Object.entries(targets)) {
    const existing = await client.query(
      "SELECT last_processed_event_id FROM projector_state WHERE projector_name = $1",
      [projectorName],
    );
    const current = Number(existing.rows[0]?.last_processed_event_id ?? -1);
    const nextCursor = Math.max(current, targetCursor);
    if (existing.rows.length === 0) {
      await client.query(
        `
        INSERT INTO projector_state (projector_name, last_processed_event_id, updated_at, last_error)
        VALUES ($1, $2, now(), null)
      `,
        [projectorName, nextCursor],
      );
    } else if (nextCursor !== current) {
      await client.query(
        `
        UPDATE projector_state
        SET last_processed_event_id = $2, updated_at = now(), last_error = null
        WHERE projector_name = $1
      `,
        [projectorName, nextCursor],
      );
    }
    updated.push({ projectorName, current, targetCursor, nextCursor });
  }
  return updated;
}

async function applyRestore(databaseUrl, targets) {
  const lockClient = new pg.Client(buildPgConnectionConfig(databaseUrl));
  const helperClient = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await helperClient.connect();

  let terminated = [];
  try {
    terminated = await terminateBlockers(helperClient, helperClient.processID);
  } finally {
    await helperClient.end().catch(() => undefined);
  }

  await lockClient.connect();
  try {
    await lockClient.query("BEGIN");
    await lockClient.query("SET lock_timeout = '120s'");
    await lockClient.query("LOCK TABLE projector_state IN SHARE ROW EXCLUSIVE MODE");
    const updated = await upsertCursors(lockClient, targets);
    await lockClient.query("COMMIT");
    return { terminated, updated };
  } catch (error) {
    await lockClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await lockClient.end().catch(() => undefined);
  }
}

async function main() {
  const { apply, domainEventCutoff, relayCutoff } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  await client.connect();
  try {
    const { targets, domainTarget, relayTarget } = await resolveTargets(
      client,
      domainEventCutoff,
      relayCutoff,
    );
    const current = await readCurrentCursors(client);
    const plan = Object.entries(targets).map(([projectorName, targetCursor]) => ({
      projectorName,
      current: current[projectorName] ?? null,
      targetCursor,
      nextCursor: Math.max(current[projectorName] ?? -1, targetCursor),
    }));

    console.log(
      JSON.stringify(
        {
          apply,
          domainEventCutoff,
          relayCutoff,
          domainEventTargetMaxId: domainTarget,
          relayTargetMaxId: relayTarget,
          projectorCount: plan.length,
          plan,
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log("Dry run only; pass --apply to restore projector_state.");
      return;
    }

    const result = await applyRestore(databaseUrl, targets);
    console.log(JSON.stringify({ applyResult: result }, null, 2));
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
