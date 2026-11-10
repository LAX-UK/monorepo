import { collectionBooking, domainEvent, emailEvent, emailOutbox } from "@auction/db/schema";
import { COLLECTION_BOOKING_EVENT_AGGREGATE } from "@auction/domain";
import { emailHash } from "@auction/email";
import { and, eq, inArray, isNotNull, isNull, like, ne, notInArray, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import type { BidAnonymisationScope } from "./bid-anonymisation-scope.js";
import { involvedIn } from "./collection-booking-involvement.js";

type Scope = Pick<BidAnonymisationScope, "subjectIds" | "personalLegalEntityIds">;

/** The confirmation that the account is gone: it is sent to the address after erasure. */
const DELETION_CONFIRMATION = "account-deletion-completed";
/** Left on a queued email that erasure stopped; read by staff, holds no personal data. */
export const ACCOUNT_ERASED_REASON = "account_erased";

/** A key that holds an address. Keys made from ids and hashes never contain an "@". */
const KEY_HOLDS_ADDRESS = like(emailOutbox.idempotencyKey, "%@%");
/** What replaces a key that held an address: unique, and says nothing about anyone. */
const NEUTRAL_KEY = sql`'erased:' || ${emailOutbox.id}::text`;
const NO_VARS = sql`'{}'::jsonb`;

/** Mail that is queued or being sent is never changed: scrubbing it would break the send. */
const FINISHED = notInArray(emailOutbox.status, ["pending", "sending"]);

const anyOf = (...conditions: (SQL | undefined)[]) =>
  or(...conditions.filter((condition): condition is SQL => condition !== undefined));

async function ownAddressHashes(tx: ProjectorDbConnection, subjectIds: readonly string[]) {
  const rows = await tx
    .selectDistinct({ hash: emailOutbox.toEmailHash })
    .from(emailOutbox)
    .where(inArray(emailOutbox.userId, [...subjectIds]));
  return rows.map((row) => row.hash);
}

/**
 * What marks a collection email as one of the person's bookings: the booking id (reminders) or
 * the id of an event on it (every other kind) is the second part of its key. The addresses are
 * the collectors those bookings named, who have no account of their own.
 */
async function namedCollectors(tx: ProjectorDbConnection, scope: Scope) {
  const bookings = await tx
    .select({ id: collectionBooking.id, email: collectionBooking.collectorEmail })
    .from(collectionBooking)
    .where(involvedIn(scope));
  if (bookings.length === 0) return { hashes: [], keyIds: [] };
  const bookingIds = bookings.map((booking) => booking.id);
  const events = await tx
    .select({ id: domainEvent.id })
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.aggregateType, COLLECTION_BOOKING_EVENT_AGGREGATE),
        inArray(domainEvent.aggregateId, bookingIds),
      ),
    );
  return {
    hashes: bookings.flatMap((booking) => (booking.email ? [emailHash(booking.email)] : [])),
    keyIds: [...bookingIds, ...events.map((event) => String(event.id))],
  };
}

/**
 * The finished mail rows that belong to the erased person:
 * - rows of their own account;
 * - rows with no account sent to an address their own rows were sent to (such as a billing copy),
 *   except the confirmation of the erasure itself;
 * - collection emails to a collector their bookings named, for those bookings only.
 */
async function rowsOfThePerson(tx: ProjectorDbConnection, scope: Scope): Promise<SQL | undefined> {
  const own = await ownAddressHashes(tx, scope.subjectIds);
  const collectors = await namedCollectors(tx, scope);
  const match = anyOf(
    inArray(emailOutbox.userId, [...scope.subjectIds]),
    own.length > 0
      ? and(
          isNull(emailOutbox.userId),
          inArray(emailOutbox.toEmailHash, own),
          ne(emailOutbox.template, DELETION_CONFIRMATION),
        )
      : undefined,
    collectors.hashes.length > 0 && collectors.keyIds.length > 0
      ? and(
          isNull(emailOutbox.userId),
          like(emailOutbox.template, "collection-%"),
          inArray(emailOutbox.toEmailHash, collectors.hashes),
          inArray(sql`split_part(${emailOutbox.idempotencyKey}, ':', 2)`, collectors.keyIds),
        )
      : undefined,
  );
  return and(FINISHED, match);
}

const STILL_HOLDS_PERSONAL_DATA = or(
  KEY_HOLDS_ADDRESS,
  isNotNull(emailOutbox.toSnapshot),
  sql`${emailOutbox.vars} <> '{}'::jsonb`,
  and(isNotNull(emailOutbox.lastError), ne(emailOutbox.lastError, ACCOUNT_ERASED_REASON)),
);

/**
 * Mail the person had queued but not yet sent is stopped, except the confirmation of the erasure.
 * The row is marked suppressed for this one email; the address is not blocked for anyone.
 */
async function stopQueuedMail(tx: ProjectorDbConnection, scope: Scope): Promise<string[]> {
  const rows = await tx
    .update(emailOutbox)
    .set({ status: "suppressed", lastError: ACCOUNT_ERASED_REASON })
    .where(
      and(
        inArray(emailOutbox.userId, [...scope.subjectIds]),
        eq(emailOutbox.status, "pending"),
        ne(emailOutbox.template, DELETION_CONFIRMATION),
      ),
    )
    .returning({ id: emailOutbox.id });
  return rows.map((row) => row.id);
}

export type MailQueueErasureCounts = { email_outbox: number; email_event: number };

/**
 * Removes what the mail queue holds about a purged person. Rows stay as the record that a message
 * was sent, but lose anything that identifies the recipient: an address in the key, the recipient
 * snapshot, the message variables (names, addresses, calendar entries) and the provider's error
 * text, which can quote the address. The provider's delivery reports for those messages quote the
 * recipient and the bounce text, so their bodies are emptied; the events stay as counts of what
 * happened.
 *
 * The person's rows are found once, before anything is rewritten, and both steps work on that set:
 * scrubbing a key stops a row matching on it, so finding them again would miss their events. It
 * sets fixed values, so a second run changes nothing more.
 */
export async function scrubMailQueue(
  tx: ProjectorDbConnection,
  scope: Scope,
): Promise<MailQueueErasureCounts> {
  const stopped = await stopQueuedMail(tx, scope);
  const match = await rowsOfThePerson(tx, scope);
  const found = await tx
    .select({ id: emailOutbox.id, messageId: emailOutbox.messageId })
    .from(emailOutbox)
    .where(match);
  const ids = found.map((row) => row.id);
  const messageIds = found.flatMap((row) => (row.messageId ? [row.messageId] : []));

  const scrubbed =
    ids.length === 0
      ? []
      : await tx
          .update(emailOutbox)
          .set({
            idempotencyKey: sql`CASE WHEN ${KEY_HOLDS_ADDRESS} THEN ${NEUTRAL_KEY} ELSE ${emailOutbox.idempotencyKey} END`,
            toSnapshot: null,
            toSnapshotPurgeAt: null,
            vars: NO_VARS,
            lastError: sql`CASE WHEN ${emailOutbox.lastError} = ${ACCOUNT_ERASED_REASON} THEN ${emailOutbox.lastError} ELSE NULL END`,
          })
          .where(and(inArray(emailOutbox.id, ids), STILL_HOLDS_PERSONAL_DATA))
          .returning({ id: emailOutbox.id });

  // The provider's reports link to a message by its id; a webhook may not know the outbox row.
  const reported = anyOf(
    ids.length > 0 ? inArray(emailEvent.outboxId, ids) : undefined,
    messageIds.length > 0 ? inArray(emailEvent.messageId, messageIds) : undefined,
  );
  const events = reported
    ? await tx
        .update(emailEvent)
        .set({ payload: NO_VARS })
        .where(and(sql`${emailEvent.payload} <> '{}'::jsonb`, reported))
        .returning({ id: emailEvent.id })
    : [];
  return {
    email_outbox: new Set([...stopped, ...scrubbed.map((row) => row.id)]).size,
    email_event: events.length,
  };
}
