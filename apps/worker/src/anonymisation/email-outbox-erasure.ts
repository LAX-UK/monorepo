import { collectionBooking, emailOutbox } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { and, inArray, isNotNull, like, or, sql } from "drizzle-orm";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import { type ErasureScope, involvedIn } from "./collection-booking-erasure.js";

/** A key that holds an address. Keys made from ids and hashes never contain an "@". */
const KEY_HOLDS_ADDRESS = like(emailOutbox.idempotencyKey, "%@%");

/** What replaces a key that held an address: unique, and says nothing about anyone. */
const NEUTRAL_KEY = sql`'erased:' || ${emailOutbox.id}::text`;

/** Collection emails to a collector who has no account of their own. */
const COLLECTION_TEMPLATES = like(emailOutbox.template, "collection-%");

async function hashesOfNamedCollectors(
  tx: ProjectorDbConnection,
  scope: ErasureScope,
): Promise<string[]> {
  const rows = await tx
    .select({ email: collectionBooking.collectorEmail })
    .from(collectionBooking)
    .where(and(involvedIn(scope), isNotNull(collectionBooking.collectorEmail)));
  return rows.flatMap((row) => (row.email ? [emailHash(row.email)] : []));
}

/**
 * Removes the raw address from the mail queue rows of a purged person: the key (when it was made
 * from the address) and the 30-day recipient snapshot. Covers rows of the person's own accounts
 * and collection emails to a collector their bookings named. Returns the rows changed. It sets
 * fixed values, so a second run changes nothing more.
 */
export async function scrubEmailOutbox(
  tx: ProjectorDbConnection,
  scope: ErasureScope,
): Promise<number> {
  const collectorHashes = await hashesOfNamedCollectors(tx, scope);
  const ofTheirAccount = inArray(emailOutbox.userId, [...scope.subjectIds]);
  const toANamedCollector =
    collectorHashes.length > 0
      ? and(COLLECTION_TEMPLATES, inArray(emailOutbox.toEmailHash, collectorHashes))
      : undefined;
  const rows = await tx
    .update(emailOutbox)
    .set({
      idempotencyKey: sql`CASE WHEN ${KEY_HOLDS_ADDRESS} THEN ${NEUTRAL_KEY} ELSE ${emailOutbox.idempotencyKey} END`,
      toSnapshot: null,
      toSnapshotPurgeAt: null,
    })
    .where(
      and(
        or(ofTheirAccount, toANamedCollector),
        or(KEY_HOLDS_ADDRESS, isNotNull(emailOutbox.toSnapshot)),
      ),
    )
    .returning({ id: emailOutbox.id });
  return rows.length;
}
