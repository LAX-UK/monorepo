/**
 * Rewrites collection reminder outbox keys from the old format to the current one.
 *
 * Old: collection-reminder:<bookingId>:<slotStart ISO>:<email address>
 * New: collection-reminder:<bookingId>:<slotStart ISO>:<account id, or sha256 of the address>
 *
 * Dry run by default: prints counts, takes no row locks and writes nothing. Pass --apply to write.
 * Safe to re-run: a rewritten row no longer matches. Rows whose personal data was erased
 * (account_erased, or a key already replaced by `erased:<id>`) are never read or changed, and a row
 * is skipped when the new key already exists, so no two rows ever share a key. The dry run counts
 * exactly what --apply would: of several old keys that map to one new key, only the first counts.
 * Each batch transaction sets lock_timeout, so a busy row stops the run (rolled back, nothing of
 * that batch written) instead of waiting behind live traffic; re-run it.
 *
 *   DATABASE_URL_OWNER=... pnpm --filter @auction/db db:backfill-collection-reminder-keys [--apply]
 */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { closeDb, createDb } from "../client.js";
import { collectFlags } from "./backfill-cli-flags.js";

type Db = ReturnType<typeof createDb>;

const ERASED_REASON = "account_erased";
/** Longest one batch waits for a row lock held by live traffic. */
export const LOCK_TIMEOUT_MS = 5000;
const OLD_KEY = /^(collection-reminder:[^:]+:\d{4}-\d{2}-\d{2}T[^:]+:[^:]+:[^:]+Z):(.+@.+)$/;

export type ReminderKeyBackfillCounts = {
  scanned: number;
  rewritten: number;
  skippedExisting: number;
  skippedUnparsable: number;
};

const hashOf = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

export function newReminderKey(oldKey: string, userId: string | null): string | null {
  const match = OLD_KEY.exec(oldKey);
  if (!match) return null;
  const [, prefix, email] = match;
  return `${prefix}:${userId ?? hashOf(email as string)}`;
}

export async function backfillCollectionReminderKeys(
  db: Pick<Db, "transaction">,
  options: { apply: boolean; batchSize?: number; lockTimeoutMs?: number },
): Promise<ReminderKeyBackfillCounts> {
  const batchSize = options.batchSize ?? 500;
  const counts: ReminderKeyBackfillCounts = {
    scanned: 0,
    rewritten: 0,
    skippedExisting: 0,
    skippedUnparsable: 0,
  };
  const lockTimeoutMs = options.lockTimeoutMs ?? LOCK_TIMEOUT_MS;
  // A dry run writes nothing, so it must not hold a lock; keys it would write are remembered so a
  // second old key that maps to the same new key is counted as skipped, as --apply would skip it.
  const lock = options.apply ? sql`FOR UPDATE` : sql``;
  const planned = new Set<string>();
  let after = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const done = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('lock_timeout', ${`${lockTimeoutMs}ms`}, true)`);
      const { rows } = await tx.execute(sql`
        SELECT id, idempotency_key, user_id FROM email_outbox
        WHERE template = 'collection-reminder'
          AND idempotency_key LIKE 'collection-reminder:%@%'
          AND (last_error IS NULL OR last_error <> ${ERASED_REASON})
          AND id > ${after}::uuid
        ORDER BY id LIMIT ${batchSize} ${lock}`);
      if (rows.length === 0) return true;
      for (const row of rows as { id: string; idempotency_key: string; user_id: string | null }[]) {
        after = row.id;
        counts.scanned += 1;
        const next = newReminderKey(row.idempotency_key, row.user_id);
        if (!next) {
          counts.skippedUnparsable += 1;
          continue;
        }
        const taken = await tx.execute(
          sql`SELECT 1 FROM email_outbox WHERE idempotency_key = ${next} LIMIT 1`,
        );
        if (taken.rows.length > 0 || planned.has(next)) {
          counts.skippedExisting += 1;
          continue;
        }
        if (!options.apply) {
          planned.add(next);
          counts.rewritten += 1;
          continue;
        }
        const updated = await tx.execute(sql`
          UPDATE email_outbox SET idempotency_key = ${next}
          WHERE id = ${row.id}::uuid AND idempotency_key = ${row.idempotency_key}
            AND NOT EXISTS (SELECT 1 FROM email_outbox WHERE idempotency_key = ${next})`);
        if ((updated.rowCount ?? 0) > 0) counts.rewritten += 1;
        else counts.skippedExisting += 1;
      }
      return rows.length < batchSize;
    });
    if (done) break;
  }
  return counts;
}

/** Only `--apply` is accepted; anything else (a typo, a repeat) throws rather than dry-running. */
export function parseReminderBackfillArgs(argv: readonly string[]): { apply: boolean } {
  return { apply: collectFlags(argv, []).apply };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const { apply } = parseReminderBackfillArgs(argv);
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_OWNER required");
  const db = createDb(url);
  try {
    const c = await backfillCollectionReminderKeys(db, { apply });
    console.log(
      `${apply ? "applied" : "dry run (nothing written; pass --apply)"}: scanned=${c.scanned} ` +
        `${apply ? "rewritten" : "would_rewrite"}=${c.rewritten} ` +
        `skipped_existing=${c.skippedExisting} skipped_unparsable=${c.skippedUnparsable}`,
    );
  } finally {
    await closeDb(db);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
