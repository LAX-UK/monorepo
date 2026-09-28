#!/usr/bin/env node
/**
 * Forward-only repair for identity_lifecycle_outbox_relay (dry run by default).
 * With --apply, requires --cutoff <iso>: target cursor is max(outbox.id) with occurred_at < cutoff.
 */
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const PROJECTOR = "identity_lifecycle_outbox_relay";

function parseArgs(argv) {
  let apply = false;
  let cutoff = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--cutoff") {
      cutoff = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return { apply, cutoff };
}

async function main() {
  const { apply, cutoff } = parseArgs(process.argv.slice(2));
  if (apply && !cutoff) {
    throw new Error(
      "--apply requires --cutoff <iso8601> (e.g. last green soak minus outbox max age)",
    );
  }
  const cutoffMs = cutoff ? Date.parse(cutoff) : Number.NaN;
  if (apply && !Number.isFinite(cutoffMs)) {
    throw new Error(`Invalid --cutoff timestamp: ${cutoff}`);
  }

  const databaseUrl = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
  }

  const client = new pg.Client(buildPgConnectionConfig(databaseUrl));
  try {
    await client.connect();
    const current = await client.query(
      "SELECT last_processed_event_id FROM projector_state WHERE projector_name = $1",
      [PROJECTOR],
    );
    const currentCursor = Number(current.rows[0]?.last_processed_event_id ?? -1);

    let targetCursor;
    if (apply) {
      const targetRow = await client.query(
        `
        SELECT coalesce(max(id), 0)::bigint AS max_id
        FROM identity_lifecycle_outbox
        WHERE occurred_at < $1::timestamptz
      `,
        [cutoff],
      );
      targetCursor = Number(targetRow.rows[0]?.max_id ?? 0);
    } else {
      const maxRow = await client.query(
        "SELECT coalesce(max(id), 0)::bigint AS max_id FROM identity_lifecycle_outbox",
      );
      targetCursor = Number(maxRow.rows[0]?.max_id ?? 0);
    }

    const forwardOnly = targetCursor >= currentCursor;
    console.log(
      JSON.stringify(
        {
          projector: PROJECTOR,
          currentCursor,
          targetCursor,
          cutoff: cutoff || null,
          forwardOnly,
          apply,
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log("Dry run only; pass --apply and --cutoff to update projector_state.");
      return;
    }
    if (targetCursor < currentCursor) {
      throw new Error(
        `Refusing to move cursor backward (current=${currentCursor}, target=${targetCursor})`,
      );
    }
    if (targetCursor <= currentCursor) {
      console.log("Cursor already at or above target; no update needed.");
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
