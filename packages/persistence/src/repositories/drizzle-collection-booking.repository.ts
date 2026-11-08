import type { Database } from "@auction/db";
import type * as schema from "@auction/db/schema";
import { collectionBooking, collectionBookingLot } from "@auction/db/schema";
import type { CollectionBookingStatus, CollectionIdType, CollectorKind } from "@auction/domain";
import { and, asc, count, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type {
  BookingOutcome,
  CancelCollectionBooking,
  CancelOutcome,
  ChangeCollectionBooking,
  ChangeOutcome,
  CollectionBookingLotRecord,
  CollectionBookingRecord,
  HandOverOutcome,
  ICollectionBookingReader,
  ICollectionBookingWriter,
  ICollectionOutcomeWriter,
  MarkNotCollected,
  NewCollectionBooking,
  NotCollectedOutcome,
  RecordHandOver,
  UndoHandOver,
  UndoOutcome,
} from "../interfaces/collection-booking.repository.js";
import { pgUniqueViolationConstraint } from "../lib/pg-unique-violation.js";

/** A database or a transaction on it: both run the same queries. */
type Conn = PgDatabase<NodePgQueryResultHKT, typeof schema>;

type BookingRow = typeof collectionBooking.$inferSelect;
type LotRow = typeof collectionBookingLot.$inferSelect;

/** The names of the unique indexes the rules rest on (see migration 0334). */
const SEAT_INDEX = "collection_booking_seat_live_uidx";
const IDEMPOTENCY_INDEX = "collection_booking_idempotency_uidx";
const LOT_HELD_INDEXES: readonly string[] = [
  "collection_booking_lot_active_uidx",
  "collection_booking_lot_pkey",
];

/** The most numbered places one slot can hold, staff overrides included (matches the check). */
const MAX_SEAT = 50;

/** The predicate of the partial unique index on places, as Postgres must see it to use the index. */
const LIVE_BOOKING = sql.raw("status = 'booked'");

function toLot(row: LotRow): CollectionBookingLotRecord {
  return {
    lotId: row.lotId,
    active: row.active,
    outcome: row.outcome === "collected" || row.outcome === "left" ? row.outcome : null,
  };
}

function toRecord(row: BookingRow, lots: readonly LotRow[]): CollectionBookingRecord {
  return {
    id: row.id,
    reference: row.reference,
    legalEntityId: row.legalEntityId,
    venueId: row.venueId,
    slotStart: row.slotStart,
    slotEnd: row.slotEnd,
    seat: row.seat,
    status: row.status as CollectionBookingStatus,
    bookedByUserId: row.bookedByUserId,
    bookedVia: row.bookedVia === "staff" ? "staff" : "client",
    overCapacity: row.overCapacity,
    overCapacityReason: row.overCapacityReason,
    collector: {
      kind: row.collectorKind as CollectorKind,
      name: row.collectorName,
      email: row.collectorEmail,
      company: row.collectorCompany,
      userId: row.collectorUserId,
    },
    authorisedByUserId: row.authorisedByUserId,
    authorisedAt: row.authorisedAt,
    policyVersion: row.policyVersion,
    icsSequence: row.icsSequence,
    idCheckType: (row.idCheckType as CollectionIdType | null) ?? null,
    outcomeByUserId: row.outcomeByUserId,
    outcomeAt: row.outcomeAt,
    cancelledByUserId: row.cancelledByUserId,
    cancelledAt: row.cancelledAt,
    personalDetailsErasedAt: row.personalDetailsErasedAt,
    lots: lots.filter((lot) => lot.bookingId === row.id).map(toLot),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The bookings with their lots, in the order of `ids`; ids with no booking are skipped. */
async function loadRecords(conn: Conn, ids: readonly string[]): Promise<CollectionBookingRecord[]> {
  if (ids.length === 0) return [];
  const rows = await conn
    .select()
    .from(collectionBooking)
    .where(inArray(collectionBooking.id, [...ids]));
  const lots = await conn
    .select()
    .from(collectionBookingLot)
    .where(inArray(collectionBookingLot.bookingId, [...ids]))
    .orderBy(asc(collectionBookingLot.lotId));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toRecord(row, lots)] : [];
  });
}

async function loadRecord(conn: Conn, id: string): Promise<CollectionBookingRecord> {
  const [record] = await loadRecords(conn, [id]);
  if (!record) throw new Error(`Collection booking ${id} disappeared inside its transaction`);
  return record;
}

/** The fields a new or changed booking stores about who collects. */
function collectorColumns(input: NewCollectionBooking["collector"]) {
  return {
    collectorKind: input.kind,
    collectorName: input.name,
    collectorEmail: input.email,
    collectorCompany: input.company,
    collectorUserId: input.userId,
    authorisedByUserId: input.authorisedByUserId,
    authorisedAt: input.authorisedAt,
    policyVersion: input.policyVersion,
  };
}

/** The seats a claim tries, in order: the first `places`, then (staff only) the rest up to the cap. */
function seatsToTry(placesPerSlot: number, overCapacityAllowed: boolean): number[] {
  const last = overCapacityAllowed ? MAX_SEAT : placesPerSlot;
  return Array.from({ length: last }, (_, i) => i + 1);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Thrown to leave a transaction without storing anything, carrying the answer to return. */
class Abandon<T> extends Error {
  constructor(readonly outcome: T) {
    super("collection booking transaction abandoned");
  }
}

export class DrizzleCollectionBookingRepository
  implements ICollectionBookingWriter, ICollectionOutcomeWriter, ICollectionBookingReader
{
  constructor(private readonly db: Database) {}

  // ---- reading ----------------------------------------------------------------------------

  async findById(bookingId: string): Promise<CollectionBookingRecord | null> {
    const [record] = await loadRecords(this.db, [bookingId]);
    return record ?? null;
  }

  async findByReference(reference: string): Promise<CollectionBookingRecord | null> {
    const [row] = await this.db
      .select({ id: collectionBooking.id })
      .from(collectionBooking)
      .where(eq(collectionBooking.reference, reference))
      .limit(1);
    return row ? this.findById(row.id) : null;
  }

  async listForAccount(legalEntityId: string, limit: number): Promise<CollectionBookingRecord[]> {
    const rows = await this.db
      .select({ id: collectionBooking.id })
      .from(collectionBooking)
      .where(eq(collectionBooking.legalEntityId, legalEntityId))
      .orderBy(desc(collectionBooking.slotStart), asc(collectionBooking.id))
      .limit(limit);
    return loadRecords(
      this.db,
      rows.map((row) => row.id),
    );
  }

  async listInRange(
    venueId: string,
    range: { from: Date; to: Date },
  ): Promise<CollectionBookingRecord[]> {
    const rows = await this.db
      .select({ id: collectionBooking.id })
      .from(collectionBooking)
      .where(
        and(
          eq(collectionBooking.venueId, venueId),
          gte(collectionBooking.slotStart, range.from),
          lt(collectionBooking.slotStart, range.to),
        ),
      )
      .orderBy(asc(collectionBooking.slotStart), asc(collectionBooking.seat));
    return loadRecords(
      this.db,
      rows.map((row) => row.id),
    );
  }

  async findLiveByLots(lotIds: readonly string[]): Promise<Map<string, CollectionBookingRecord>> {
    return liveBookingsByLot(this.db, lotIds);
  }

  async takenPlaces(
    venueId: string,
    range: { from: Date; to: Date },
  ): Promise<Map<number, number>> {
    const rows = await this.db
      .select({ slotStart: collectionBooking.slotStart, taken: count() })
      .from(collectionBooking)
      .where(
        and(
          eq(collectionBooking.venueId, venueId),
          eq(collectionBooking.status, "booked"),
          gte(collectionBooking.slotStart, range.from),
          lt(collectionBooking.slotStart, range.to),
        ),
      )
      .groupBy(collectionBooking.slotStart);
    return new Map(rows.map((row) => [row.slotStart.getTime(), Number(row.taken)]));
  }

  // ---- booking ----------------------------------------------------------------------------

  async book(input: NewCollectionBooking): Promise<BookingOutcome> {
    const lotIds = unique(input.lotIds);
    try {
      return await this.db.transaction(async (tx): Promise<BookingOutcome> => {
        const replay = await this.findByKey(tx, input.legalEntityId, input.idempotencyKey);
        if (replay) return { outcome: "replayed", booking: replay };

        const id = await claimNewSeat(tx, input);
        if (id === null) return { outcome: "slot_full" };
        await tx
          .insert(collectionBookingLot)
          .values(lotIds.map((lotId) => ({ bookingId: id, lotId })));
        return { outcome: "booked", booking: await loadRecord(tx, id) };
      });
    } catch (error) {
      const constraint = pgUniqueViolationConstraint(error);
      if (constraint === IDEMPOTENCY_INDEX) {
        // The same request raced itself: the other attempt won, and this one is its replay.
        const booking = await this.findByKey(this.db, input.legalEntityId, input.idempotencyKey);
        if (booking) return { outcome: "replayed", booking };
      }
      if (constraint !== null && LOT_HELD_INDEXES.includes(constraint)) {
        return { outcome: "lot_taken", lotIds: await this.lotsHeldElsewhere(lotIds, null) };
      }
      throw error;
    }
  }

  async change(input: ChangeCollectionBooking): Promise<ChangeOutcome> {
    const lotIds = unique(input.lotIds);
    try {
      return await this.db.transaction(async (tx): Promise<ChangeOutcome> => {
        const [row] = await tx
          .select()
          .from(collectionBooking)
          .where(eq(collectionBooking.id, input.bookingId))
          .for("update")
          .limit(1);
        if (!row) return { outcome: "not_found" };
        if (row.status !== "booked" || row.icsSequence !== input.expectedSequence) {
          return { outcome: "stale" };
        }
        await this.setLots(tx, input.bookingId, lotIds);

        const sameSlot = row.slotStart.getTime() === input.slotStart.getTime();
        const changes = {
          slotStart: input.slotStart,
          slotEnd: input.slotEnd,
          ...collectorColumns(input.collector),
          icsSequence: row.icsSequence + 1,
          updatedAt: new Date(),
        };
        const staffOverride = input.overCapacityReason !== null;
        const seats = sameSlot ? [row.seat] : seatsToTry(input.placesPerSlot, staffOverride);
        const seat = await claimSeatByUpdate(tx, input.bookingId, seats, (candidate) => ({
          ...changes,
          seat: candidate,
          overCapacity: candidate > input.placesPerSlot,
          overCapacityReason: candidate > input.placesPerSlot ? input.overCapacityReason : null,
        }));
        if (seat === null) throw new Abandon<ChangeOutcome>({ outcome: "slot_full" });
        return { outcome: "changed", booking: await loadRecord(tx, input.bookingId) };
      });
    } catch (error) {
      if (error instanceof Abandon) return error.outcome as ChangeOutcome;
      const constraint = pgUniqueViolationConstraint(error);
      if (constraint !== null && LOT_HELD_INDEXES.includes(constraint)) {
        return {
          outcome: "lot_taken",
          lotIds: await this.lotsHeldElsewhere(lotIds, input.bookingId),
        };
      }
      throw error;
    }
  }

  async cancel(input: CancelCollectionBooking): Promise<CancelOutcome> {
    return this.db.transaction(async (tx): Promise<CancelOutcome> => {
      const row = await lockBooking(tx, input.bookingId);
      if (!row) return { outcome: "not_found" };
      if (row.status !== "booked" || row.icsSequence !== input.expectedSequence) {
        return { outcome: "stale" };
      }
      await tx
        .update(collectionBooking)
        .set({
          status: "cancelled",
          cancelledByUserId: input.cancelledByUserId,
          cancelledAt: input.at,
          icsSequence: row.icsSequence + 1,
          updatedAt: input.at,
        })
        .where(eq(collectionBooking.id, input.bookingId));
      await tx
        .update(collectionBookingLot)
        .set({ active: false })
        .where(eq(collectionBookingLot.bookingId, input.bookingId));
      return { outcome: "cancelled", booking: await loadRecord(tx, input.bookingId) };
    });
  }

  // ---- the desk ---------------------------------------------------------------------------

  async recordHandOver(input: RecordHandOver): Promise<HandOverOutcome> {
    const handed = unique(input.handedOverLotIds);
    if (handed.length === 0) throw new RangeError("A hand-over needs at least one lot");
    return this.db.transaction(async (tx): Promise<HandOverOutcome> => {
      const row = await lockBooking(tx, input.bookingId);
      if (!row) return { outcome: "not_found" };
      if (row.status !== "booked") return { outcome: "stale" };
      const live = (await activeLots(tx, input.bookingId)).map((lot) => lot.lotId);
      const strangers = handed.filter((lotId) => !live.includes(lotId));
      if (strangers.length > 0) return { outcome: "lot_not_in_booking", lotIds: strangers };
      const left = live.filter((lotId) => !handed.includes(lotId));

      await tx
        .update(collectionBooking)
        .set({
          status: left.length === 0 ? "collected" : "partly_collected",
          idCheckType: input.idCheckType,
          outcomeByUserId: input.staffUserId,
          outcomeAt: input.at,
          updatedAt: input.at,
        })
        .where(eq(collectionBooking.id, input.bookingId));
      await this.closeLots(tx, input.bookingId, "collected", handed);
      await this.closeLots(tx, input.bookingId, "left", left);
      return {
        outcome: "handed_over",
        booking: await loadRecord(tx, input.bookingId),
        handedOverLotIds: handed,
        leftLotIds: left,
      };
    });
  }

  async markNotCollected(input: MarkNotCollected): Promise<NotCollectedOutcome> {
    return this.db.transaction(async (tx): Promise<NotCollectedOutcome> => {
      const row = await lockBooking(tx, input.bookingId);
      if (!row) return { outcome: "not_found" };
      if (row.status !== "booked") return { outcome: "stale" };
      await tx
        .update(collectionBooking)
        .set({
          status: "not_collected",
          outcomeByUserId: input.staffUserId,
          outcomeAt: input.at,
          updatedAt: input.at,
        })
        .where(eq(collectionBooking.id, input.bookingId));
      const live = (await activeLots(tx, input.bookingId)).map((lot) => lot.lotId);
      await this.closeLots(tx, input.bookingId, "left", live);
      return { outcome: "marked", booking: await loadRecord(tx, input.bookingId) };
    });
  }

  async undoHandOver(input: UndoHandOver): Promise<UndoOutcome> {
    try {
      return await this.db.transaction(async (tx): Promise<UndoOutcome> => {
        const row = await lockBooking(tx, input.bookingId);
        if (!row) return { outcome: "not_found" };
        if (row.status !== "collected" && row.status !== "partly_collected") {
          return { outcome: "stale" };
        }
        // The lots that were closed come back; one booked again since stops the undo.
        await tx
          .update(collectionBookingLot)
          .set({ active: true, outcome: null })
          .where(
            and(
              eq(collectionBookingLot.bookingId, input.bookingId),
              inArray(collectionBookingLot.outcome, ["collected", "left"]),
            ),
          );
        // Its own place first; any free one if it was taken since. Staff may exceed capacity.
        const others = seatsToTry(MAX_SEAT, true).filter((seat) => seat !== row.seat);
        const seat = await claimSeatByUpdate(
          tx,
          input.bookingId,
          [row.seat, ...others],
          (candidate) => ({
            status: "booked",
            seat: candidate,
            idCheckType: null,
            outcomeByUserId: null,
            outcomeAt: null,
            updatedAt: input.at,
          }),
        );
        if (seat === null) throw new Error("No place free for an undone hand-over");
        return { outcome: "undone", booking: await loadRecord(tx, input.bookingId) };
      });
    } catch (error) {
      const constraint = pgUniqueViolationConstraint(error);
      if (constraint !== null && LOT_HELD_INDEXES.includes(constraint)) {
        return {
          outcome: "lot_taken",
          lotIds: await this.lotsHeldElsewhere(await this.lotsOf(input.bookingId), input.bookingId),
        };
      }
      throw error;
    }
  }

  // ---- internals --------------------------------------------------------------------------

  private async findByKey(
    conn: Conn,
    legalEntityId: string,
    key: string,
  ): Promise<CollectionBookingRecord | null> {
    const [row] = await conn
      .select({ id: collectionBooking.id })
      .from(collectionBooking)
      .where(
        and(
          eq(collectionBooking.legalEntityId, legalEntityId),
          eq(collectionBooking.idempotencyKey, key),
        ),
      )
      .limit(1);
    return row ? loadRecord(conn, row.id) : null;
  }

  /** Makes the booking's active lots exactly `lotIds`, reusing a lot's row if it was once in it. */
  private async setLots(conn: Conn, bookingId: string, lotIds: readonly string[]): Promise<void> {
    const rows = await conn
      .select()
      .from(collectionBookingLot)
      .where(eq(collectionBookingLot.bookingId, bookingId));
    const known = new Set(rows.map((row) => row.lotId));
    const drop = rows
      .filter((row) => row.active && !lotIds.includes(row.lotId))
      .map((r) => r.lotId);
    if (drop.length > 0) {
      await conn
        .update(collectionBookingLot)
        .set({ active: false })
        .where(
          and(
            eq(collectionBookingLot.bookingId, bookingId),
            inArray(collectionBookingLot.lotId, drop),
          ),
        );
    }
    const revive = lotIds.filter((lotId) => known.has(lotId));
    if (revive.length > 0) {
      await conn
        .update(collectionBookingLot)
        .set({ active: true, outcome: null })
        .where(
          and(
            eq(collectionBookingLot.bookingId, bookingId),
            inArray(collectionBookingLot.lotId, revive),
          ),
        );
    }
    const add = lotIds.filter((lotId) => !known.has(lotId));
    if (add.length > 0) {
      await conn.insert(collectionBookingLot).values(add.map((lotId) => ({ bookingId, lotId })));
    }
  }

  private async closeLots(
    conn: Conn,
    bookingId: string,
    outcome: "collected" | "left",
    lotIds: readonly string[],
  ): Promise<void> {
    if (lotIds.length === 0) return;
    await conn
      .update(collectionBookingLot)
      .set({ active: false, outcome })
      .where(
        and(
          eq(collectionBookingLot.bookingId, bookingId),
          inArray(collectionBookingLot.lotId, [...lotIds]),
        ),
      );
  }

  private async lotsOf(bookingId: string): Promise<string[]> {
    const rows = await this.db
      .select({ lotId: collectionBookingLot.lotId })
      .from(collectionBookingLot)
      .where(eq(collectionBookingLot.bookingId, bookingId));
    return rows.map((row) => row.lotId);
  }

  /** Which of `lotIds` a live booking other than `exceptBookingId` holds. */
  private async lotsHeldElsewhere(
    lotIds: readonly string[],
    exceptBookingId: string | null,
  ): Promise<string[]> {
    if (lotIds.length === 0) return [];
    const rows = await this.db
      .select({ lotId: collectionBookingLot.lotId })
      .from(collectionBookingLot)
      .where(
        and(
          inArray(collectionBookingLot.lotId, [...lotIds]),
          eq(collectionBookingLot.active, true),
          exceptBookingId === null
            ? undefined
            : ne(collectionBookingLot.bookingId, exceptBookingId),
        ),
      );
    return rows.map((row) => row.lotId);
  }
}

async function lockBooking(conn: Conn, bookingId: string): Promise<BookingRow | undefined> {
  const [row] = await conn
    .select()
    .from(collectionBooking)
    .where(eq(collectionBooking.id, bookingId))
    .for("update")
    .limit(1);
  return row;
}

function activeLots(conn: Conn, bookingId: string) {
  return conn
    .select()
    .from(collectionBookingLot)
    .where(
      and(eq(collectionBookingLot.bookingId, bookingId), eq(collectionBookingLot.active, true)),
    )
    .orderBy(asc(collectionBookingLot.lotId));
}

async function liveBookingsByLot(
  conn: Conn,
  lotIds: readonly string[],
): Promise<Map<string, CollectionBookingRecord>> {
  if (lotIds.length === 0) return new Map();
  const held = await conn
    .select({ lotId: collectionBookingLot.lotId, bookingId: collectionBookingLot.bookingId })
    .from(collectionBookingLot)
    .where(
      and(inArray(collectionBookingLot.lotId, [...lotIds]), eq(collectionBookingLot.active, true)),
    );
  const records = await loadRecords(conn, unique(held.map((row) => row.bookingId)));
  const byId = new Map(records.map((record) => [record.id, record]));
  return new Map(
    held.flatMap((row) => {
      const record = byId.get(row.bookingId);
      return record ? [[row.lotId, record] as const] : [];
    }),
  );
}

/**
 * Takes the first free numbered place in the slot by inserting the booking into it. Racing
 * requests cannot both get the same place: the partial unique index makes the second insert
 * wait for the first, and when the first commits the second finds it taken (`do nothing`) and
 * tries the next place. Returns the new booking's id, or `null` when no place is free.
 */
async function claimNewSeat(conn: Conn, input: NewCollectionBooking): Promise<string | null> {
  const staffOverride = input.overCapacityReason !== null;
  for (const seat of seatsToTry(input.placesPerSlot, staffOverride)) {
    const beyond = seat > input.placesPerSlot;
    const [created] = await conn
      .insert(collectionBooking)
      .values({
        legalEntityId: input.legalEntityId,
        venueId: input.venueId,
        slotStart: input.slotStart,
        slotEnd: input.slotEnd,
        seat,
        bookedByUserId: input.bookedByUserId,
        bookedVia: input.bookedVia,
        overCapacity: beyond,
        overCapacityReason: beyond ? input.overCapacityReason : null,
        ...collectorColumns(input.collector),
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({
        target: [collectionBooking.venueId, collectionBooking.slotStart, collectionBooking.seat],
        where: LIVE_BOOKING,
      })
      .returning({ id: collectionBooking.id });
    if (created) return created.id;
  }
  return null;
}

/**
 * Moves an existing booking into the first of `seats` that is free, with the other changes in the
 * same statement. Each try runs in its own savepoint, so a place that is taken costs one failed
 * statement and not the transaction. Returns the seat won, or `null` if none was free.
 */
async function claimSeatByUpdate(
  conn: Conn,
  bookingId: string,
  seats: readonly number[],
  changes: (seat: number) => Partial<typeof collectionBooking.$inferInsert>,
): Promise<number | null> {
  for (const seat of seats) {
    try {
      await conn.transaction((savepoint) =>
        savepoint
          .update(collectionBooking)
          .set(changes(seat))
          .where(eq(collectionBooking.id, bookingId)),
      );
      return seat;
    } catch (error) {
      if (pgUniqueViolationConstraint(error) !== SEAT_INDEX) throw error;
    }
  }
  return null;
}
