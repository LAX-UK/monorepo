import { collectionBooking } from "@auction/db/schema";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { and, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { THIRD_PARTY_COLLECTOR_PLACEHOLDER } from "../anonymisation/collection-booking-erasure.js";

type Logger = {
  info: (obj: unknown, msg?: string) => void;
};

/** The moment a hand-over must be older than for its record to be cleared. */
export function collectionHandoverCutoff(now: Date, retentionYears: number): Date {
  if (!Number.isInteger(retentionYears) || retentionYears < 1) {
    throw new RangeError("Hand-over records are kept for at least one year");
  }
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - retentionYears);
  return cutoff;
}

/**
 * Clears the record of who collected works once its retention has passed: the collector's name
 * and the kind of ID checked. It only reaches hand-overs of people whose account has been erased
 * (their email and company are already gone); everyone else's record stays with their account.
 * Running it again changes nothing.
 */
export async function purgeCollectionHandoverRecords(input: {
  transactionRunner: ITransactionRunner;
  retentionYears: number;
  log: Logger;
  now?: Date;
}): Promise<{ cleared: number }> {
  const now = input.now ?? new Date();
  const cutoff = collectionHandoverCutoff(now, input.retentionYears);
  const cleared = await input.transactionRunner.runInTransaction((tx) =>
    tx
      .update(collectionBooking)
      .set({
        collectorName: THIRD_PARTY_COLLECTOR_PLACEHOLDER,
        idCheckType: null,
        handoverRecordClearedAt: now,
      })
      .where(
        and(
          inArray(collectionBooking.status, ["collected", "partly_collected"]),
          isNotNull(collectionBooking.personalDetailsErasedAt),
          isNull(collectionBooking.handoverRecordClearedAt),
          lt(collectionBooking.outcomeAt, cutoff),
        ),
      )
      .returning({ id: collectionBooking.id }),
  );
  input.log.info(
    { cleared: cleared.length, retentionYears: input.retentionYears },
    "purge-collection-handover: done",
  );
  return { cleared: cleared.length };
}
