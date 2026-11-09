import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  collectionBooking,
  collectionBookingLot,
  emailOutbox,
  legalEntity,
  legalEntityMember,
  lot,
  venue,
} from "@auction/db/schema";
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type {
  ICollectionNoticeReader,
  RemindableVisit,
} from "../interfaces/collection-notice.reader.js";
import type { CollectionNoticeVisit, NoticeRecipient } from "../services/collection-notices.js";

/** Reads what the collection emails say, from the booking and the people around it. */
export class DrizzleCollectionNoticeReader implements ICollectionNoticeReader {
  constructor(private readonly db: Database) {}

  async visit(bookingId: string): Promise<CollectionNoticeVisit | null> {
    const [booking] = await this.db
      .select()
      .from(collectionBooking)
      .where(eq(collectionBooking.id, bookingId))
      .limit(1);
    if (!booking) return null;

    const [place] = await this.db
      .select({
        name: venue.name,
        line1: venue.addressLine1,
        line2: venue.addressLine2,
        city: venue.city,
        postcode: venue.postcode,
      })
      .from(venue)
      .where(eq(venue.id, booking.venueId))
      .limit(1);

    const lots = await this.db
      .select({
        title: lot.title,
        lotNumber: lot.lotNumber,
        active: collectionBookingLot.active,
        outcome: collectionBookingLot.outcome,
      })
      .from(collectionBookingLot)
      .innerJoin(lot, eq(lot.id, collectionBookingLot.lotId))
      .where(eq(collectionBookingLot.bookingId, bookingId))
      .orderBy(asc(lot.lotNumber), asc(lot.title));

    const [account] = await this.db
      .select({ kind: legalEntity.kind, displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, booking.legalEntityId))
      .limit(1);
    const booker = booking.bookedByUserId ? await this.person(booking.bookedByUserId) : null;
    const people = await this.accountPeople(booking.legalEntityId);

    return {
      bookingId: booking.id,
      reference: booking.reference,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      icsSequence: booking.icsSequence,
      bookedVia: booking.bookedVia === "staff" ? "staff" : "client",
      collector: {
        kind: booking.collectorKind as "self" | "member" | "third_party",
        name: booking.collectorName,
        email: booking.collectorEmail,
      },
      place: {
        name: place?.name ?? "the gallery",
        address: [place?.line1, place?.line2, place?.city, place?.postcode]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(", "),
      },
      lots: lots.map((row) => ({
        ...row,
        outcome: row.outcome === "collected" || row.outcome === "left" ? row.outcome : null,
      })),
      account: {
        kind: account?.kind === "organisation" ? "organisation" : "personal",
        name: account?.displayName ?? "",
      },
      booker: booker ? { ...booker, name: booker.name } : null,
      accountPeople: people,
    };
  }

  async dueReminders(window: {
    from: Date;
    to: Date;
    changedBefore: Date;
  }): Promise<RemindableVisit[]> {
    const rows = await this.db
      .select({ bookingId: collectionBooking.id })
      .from(collectionBooking)
      .where(
        and(
          eq(collectionBooking.status, "booked"),
          gte(collectionBooking.slotStart, window.from),
          lt(collectionBooking.slotStart, window.to),
          // Last changed, not first booked: a visit moved after 09:00 has just had its change email.
          lt(collectionBooking.updatedAt, window.changedBefore),
        ),
      )
      .orderBy(asc(collectionBooking.slotStart), asc(collectionBooking.id));
    return rows;
  }

  async collectorEmailsSince(addressHash: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(emailOutbox)
      .where(
        and(
          eq(emailOutbox.toEmailHash, addressHash),
          inArray(emailOutbox.template, ["collection-collector-notice", "collection-cancelled"]),
          gte(emailOutbox.createdAt, since),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async accountRecipients(legalEntityId: string): Promise<NoticeRecipient[]> {
    const people = await this.accountPeople(legalEntityId);
    if (people.length > 0) return people;
    // A personal account has no members to speak of: the person who made it is the buyer.
    const [account] = await this.db
      .select({ createdBy: legalEntity.createdByUserId })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    const person = account?.createdBy ? await this.person(account.createdBy) : null;
    return person ? [person] : [];
  }

  /** A person with an account still open: their address, first name and full name. */
  private async person(userId: string): Promise<(NoticeRecipient & { name: string }) | null> {
    const [row] = await this.db
      .select({
        userId: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, split_part(${bidIdentityDirectory.name}, ' ', 1))`,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(
        and(
          eq(bidIdentityDirectory.subjectId, userId),
          isNull(bidIdentityDirectory.deletionRequestedAt),
        ),
      )
      .limit(1);
    return row?.email ? row : null;
  }

  /** The account's owners and admins who have joined and not left, with a usable address. */
  private async accountPeople(legalEntityId: string): Promise<NoticeRecipient[]> {
    return this.db
      .selectDistinct({
        userId: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, split_part(${bidIdentityDirectory.name}, ' ', 1))`,
      })
      .from(legalEntityMember)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          isNull(bidIdentityDirectory.deletionRequestedAt),
          or(
            inArray(legalEntityMember.role, ["owner", "admin"]),
            eq(legalEntityMember.isPrimaryAdmin, true),
          ),
        ),
      );
  }
}
