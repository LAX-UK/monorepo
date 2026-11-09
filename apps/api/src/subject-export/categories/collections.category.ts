import { collectionBooking, collectionBookingLot, lot } from "@auction/db/schema";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { iso, isoRequired, lotRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

export type CollectionExportInput = {
  id: string;
  reference: string;
  status: string;
  slotStart: Date;
  slotEnd: Date;
  bookedVia: string;
  collectorKind: string;
  collectorName: string;
  collectorEmail: string | null;
  collectorCompany: string | null;
  bookedByUserId: string | null;
  authorisedByUserId: string | null;
  collectorUserId: string | null;
  authorisedAt: Date | null;
  idCheckType: string | null;
  outcomeAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  lots: {
    outcome: string | null;
    lot: { id: string; title: string; lotNumber: number | null };
  }[];
};

/**
 * A person's collection bookings: the ones they made, authorised or are named to collect at, and
 * no one else's. A booking an organisation's other member made, with nobody named in it but that
 * member, is not here. The collector's details are what the booker typed in, so they come back to
 * the booker, and to the person named when it is them; once erased they read as the placeholder.
 * Another member who booked is shown as "another member", never by name or id. Over-capacity
 * reasons, the staff member who handed over or cancelled, the idempotency key, the request
 * fingerprint and the policy version are never selected.
 */
export function mapCollection(input: CollectionExportInput, subjectId: string, webOrigin: string) {
  const roles = [
    input.bookedByUserId === subjectId ? "booker" : null,
    input.authorisedByUserId === subjectId ? "authoriser" : null,
    input.collectorUserId === subjectId ? "collector" : null,
  ].filter((role): role is string => role !== null);
  return {
    id: input.id,
    origin: input.bookedVia === "staff" ? ("made_by_us" as const) : ("provided" as const),
    reference: input.reference,
    status: input.status,
    visit: { start: isoRequired(input.slotStart), end: isoRequired(input.slotEnd) },
    yourRoles: roles,
    // Another member of an organisation is never named: it is their data, not the person's.
    bookedBy:
      input.bookedByUserId === subjectId
        ? "you"
        : input.bookedVia === "staff"
          ? "gallery_team"
          : "another_member",
    lots: input.lots.map((entry) => ({
      lot: lotRef(entry.lot, webOrigin),
      outcome: entry.outcome,
    })),
    collector: {
      kind: input.collectorKind,
      name: input.collectorName,
      email: input.collectorEmail,
      company: input.collectorCompany,
    },
    authorisedAt: iso(input.authorisedAt),
    idCheckType: input.idCheckType,
    bookedAt: isoRequired(input.createdAt),
    handedOverAt: iso(input.outcomeAt),
    cancelledAt: iso(input.cancelledAt),
  };
}

export class CollectionsCategory extends SourcedExportCategory {
  readonly id = "collections";
  protected readonly sources: readonly ExportSource[];

  constructor(deps: SubjectExportDeps) {
    super();
    const { db, webOrigin } = deps;
    const involvedIn = (s: string) =>
      or(
        eq(collectionBooking.bookedByUserId, s),
        eq(collectionBooking.authorisedByUserId, s),
        eq(collectionBooking.collectorUserId, s),
      );
    this.sources = [
      {
        count: (s) => countWhere(db, collectionBooking, involvedIn(s)),
        page: async (s, after, limit) => {
          const bookings = await db
            .select({
              id: collectionBooking.id,
              reference: collectionBooking.reference,
              status: collectionBooking.status,
              slotStart: collectionBooking.slotStart,
              slotEnd: collectionBooking.slotEnd,
              bookedVia: collectionBooking.bookedVia,
              collectorKind: collectionBooking.collectorKind,
              collectorName: collectionBooking.collectorName,
              collectorEmail: collectionBooking.collectorEmail,
              collectorCompany: collectionBooking.collectorCompany,
              bookedByUserId: collectionBooking.bookedByUserId,
              authorisedByUserId: collectionBooking.authorisedByUserId,
              collectorUserId: collectionBooking.collectorUserId,
              authorisedAt: collectionBooking.authorisedAt,
              idCheckType: collectionBooking.idCheckType,
              outcomeAt: collectionBooking.outcomeAt,
              cancelledAt: collectionBooking.cancelledAt,
              createdAt: collectionBooking.createdAt,
            })
            .from(collectionBooking)
            .where(and(involvedIn(s), afterKey(collectionBooking.id, after)))
            .orderBy(asc(collectionBooking.id))
            .limit(limit);
          if (bookings.length === 0) return [];
          const lots = await db
            .select({
              bookingId: collectionBookingLot.bookingId,
              outcome: collectionBookingLot.outcome,
              lotId: lot.id,
              title: lot.title,
              lotNumber: lot.lotNumber,
            })
            .from(collectionBookingLot)
            .innerJoin(lot, eq(lot.id, collectionBookingLot.lotId))
            .where(
              inArray(
                collectionBookingLot.bookingId,
                bookings.map((booking) => booking.id),
              ),
            )
            .orderBy(asc(collectionBookingLot.lotId));
          return bookings.map((booking) => ({
            key: booking.id,
            record: mapCollection(
              {
                ...booking,
                lots: lots
                  .filter((entry) => entry.bookingId === booking.id)
                  .map((entry) => ({
                    outcome: entry.outcome,
                    lot: { id: entry.lotId, title: entry.title, lotNumber: entry.lotNumber },
                  })),
              },
              s,
              webOrigin,
            ),
          }));
        },
      },
    ];
  }
}
