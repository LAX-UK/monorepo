import { emailOutbox } from "@auction/db/schema";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { and, asc, inArray, lt, sql } from "drizzle-orm";

type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/** Rows whose send is over. Queued and in-flight rows still need their recipient. */
const FINISHED_STATUSES = ["sent", "failed", "suppressed"] as const;

const DEFAULT_BATCH_SIZE = 500;
/** Bounds one run; the next day's run takes up what is left. */
const MAX_BATCHES_PER_RUN = 200;

/**
 * Clears the plaintext recipient address kept for a message once its deadline (30 days after it
 * was queued) has passed: the snapshot goes and so do the message variables, which hold names,
 * addresses and calendar entries. The key, status and address hash stay, so duplicates are still
 * recognised and delivery can still be reported.
 *
 * It only touches rows whose send is over. A row still queued or being sent keeps its snapshot
 * until it finishes, and then ages out on the next run, so mail that was in flight when an
 * account was erased, or queued after it, is cleared the same way. Rows are taken in small
 * batches, skipping any another process holds, and a cleared row no longer matches, so running it
 * again changes nothing.
 */
export async function purgeEmailSnapshots(input: {
  transactionRunner: ITransactionRunner;
  log: Logger;
  now?: Date;
  batchSize?: number;
}): Promise<{ cleared: number; batches: number }> {
  const now = input.now ?? new Date();
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  let cleared = 0;
  let batches = 0;

  while (batches < MAX_BATCHES_PER_RUN) {
    const batch = await input.transactionRunner.runInTransaction((tx) =>
      tx
        .update(emailOutbox)
        .set({ toSnapshot: null, toSnapshotPurgeAt: null, vars: sql`'{}'::jsonb` })
        .where(
          inArray(
            emailOutbox.id,
            tx
              .select({ id: emailOutbox.id })
              .from(emailOutbox)
              .where(
                and(
                  inArray(emailOutbox.status, [...FINISHED_STATUSES]),
                  lt(emailOutbox.toSnapshotPurgeAt, now),
                ),
              )
              .orderBy(asc(emailOutbox.toSnapshotPurgeAt))
              .limit(batchSize)
              .for("update", { skipLocked: true }),
          ),
        )
        .returning({ id: emailOutbox.id }),
    );
    batches += 1;
    cleared += batch.length;
    if (batch.length < batchSize) break;
  }

  if (batches === MAX_BATCHES_PER_RUN) {
    input.log.warn({ cleared, batches }, "purge-email-snapshots: stopped at the batch limit");
  }
  input.log.info({ cleared, batches }, "purge-email-snapshots: done");
  return { cleared, batches };
}
