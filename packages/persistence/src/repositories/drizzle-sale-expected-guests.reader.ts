import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import {
  legalEntity,
  legalEntityMember,
  onsiteEvent,
  onsiteEventRsvp,
  sale,
  saleRegistration,
  user,
} from "@auction/db/schema";
import type { SaleExpectedGuestRow, SaleExpectedGuestsSummary } from "@auction/types";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { ISaleExpectedGuestsReader } from "../interfaces/sale-expected-guests.reader.js";
import { groupEligibleCheckInEntities } from "../lib/saleroom-check-in-entities.js";

export class DrizzleSaleExpectedGuestsReader implements ISaleExpectedGuestsReader {
  constructor(private readonly db: Database) {}

  async listForSale(saleId: string): Promise<SaleExpectedGuestsSummary> {
    const [eventRow] = await this.db
      .select({
        slug: onsiteEvent.slug,
        title: onsiteEvent.title,
        segmentOptions: onsiteEvent.segmentOptions,
      })
      .from(onsiteEvent)
      .innerJoin(sale, eq(sale.id, onsiteEvent.saleId))
      .where(and(eq(onsiteEvent.saleId, saleId), saleNotDeleted()))
      .limit(1);

    if (!eventRow) {
      return {
        eventSlug: null,
        eventTitle: null,
        segmentOptions: [],
        items: [],
        counts: { rsvped: 0, galaCheckedIn: 0, salePresent: 0, paddled: 0 },
      };
    }

    const rsvpRows = await this.db
      .select({
        rsvpId: onsiteEventRsvp.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        kycStatus: user.kycStatus,
        emailVerified: user.emailVerified,
        suspendedAt: user.suspendedAt,
        attendanceSegment: onsiteEventRsvp.attendanceSegment,
        galaCheckedInAt: onsiteEventRsvp.checkedInAt,
        plusOne: onsiteEventRsvp.plusOne,
      })
      .from(onsiteEventRsvp)
      .innerJoin(user, eq(user.id, onsiteEventRsvp.userId))
      .where(eq(onsiteEventRsvp.eventSlug, eventRow.slug))
      .orderBy(asc(user.name), asc(user.email));

    if (rsvpRows.length === 0) {
      return {
        eventSlug: eventRow.slug,
        eventTitle: eventRow.title,
        segmentOptions: eventRow.segmentOptions ?? [],
        items: [],
        counts: { rsvped: 0, galaCheckedIn: 0, salePresent: 0, paddled: 0 },
      };
    }

    const userIds = rsvpRows.map((row) => row.userId);
    const membershipRows = await this.db
      .select({
        userId: legalEntityMember.userId,
        legalEntityId: legalEntityMember.legalEntityId,
        role: legalEntityMember.role,
        displayName: legalEntity.displayName,
        kind: legalEntity.kind,
        regId: saleRegistration.id,
        regStatus: saleRegistration.status,
        regPaddle: saleRegistration.paddleNumber,
        regBidLimit: saleRegistration.bidLimit,
        regCheckedInAt: saleRegistration.checkedInAt,
      })
      .from(legalEntityMember)
      .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
      .leftJoin(
        saleRegistration,
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.userId, legalEntityMember.userId),
          eq(saleRegistration.buyerLegalEntityId, legalEntityMember.legalEntityId),
        ),
      )
      .where(
        and(
          inArray(legalEntityMember.userId, userIds),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      );

    const entitiesByUser = groupEligibleCheckInEntities(
      membershipRows.map((row) => ({
        userId: row.userId,
        legalEntityId: row.legalEntityId,
        role: row.role,
        displayName: row.displayName,
        kind: row.kind,
        regStatus: row.regStatus,
        regPaddle: row.regPaddle,
        regBidLimit: row.regBidLimit,
        regCheckedInAt: row.regCheckedInAt,
      })),
    );

    const registrationByUser = new Map<
      string,
      {
        registrationId: string;
        status: string;
        paddleNumber: number | null;
        checkedInAt: Date | null;
      }
    >();
    for (const row of membershipRows) {
      if (row.regId == null || row.regStatus == null) continue;
      registrationByUser.set(row.userId, {
        registrationId: row.regId,
        status: row.regStatus,
        paddleNumber: row.regPaddle,
        checkedInAt: row.regCheckedInAt,
      });
    }

    const items: SaleExpectedGuestRow[] = rsvpRows.map((row) => {
      const eligibleEntities = (entitiesByUser.get(row.userId) ?? []).map((entity) => ({
        id: entity.id,
        displayName: entity.displayName,
        role: entity.role,
        kind: entity.kind,
        existingRegistration: entity.existingRegistration
          ? {
              status: entity.existingRegistration.status,
              paddleNumber: entity.existingRegistration.paddleNumber,
              bidLimit: entity.existingRegistration.bidLimit,
              checkedInAt: entity.existingRegistration.checkedInAt?.toISOString() ?? null,
            }
          : null,
      }));

      const reg = registrationByUser.get(row.userId);
      return {
        rsvpId: row.rsvpId,
        userId: row.userId,
        name: row.name,
        email: row.email,
        attendanceSegment: row.attendanceSegment,
        galaCheckedInAt: row.galaCheckedInAt?.toISOString() ?? null,
        plusOne: row.plusOne,
        kycApproved: row.kycStatus === "approved",
        emailVerified: row.emailVerified,
        suspended: row.suspendedAt != null,
        eligibleEntities,
        saleRegistration: reg
          ? {
              registrationId: reg.registrationId,
              status: reg.status,
              paddleNumber: reg.paddleNumber,
              checkedInAt: reg.checkedInAt?.toISOString() ?? null,
            }
          : null,
      };
    });

    const counts = {
      rsvped: items.length,
      galaCheckedIn: items.filter((row) => row.galaCheckedInAt != null).length,
      salePresent: items.filter((row) => row.saleRegistration?.checkedInAt != null).length,
      paddled: items.filter((row) => row.saleRegistration?.paddleNumber != null).length,
    };

    return {
      eventSlug: eventRow.slug,
      eventTitle: eventRow.title,
      segmentOptions: eventRow.segmentOptions ?? [],
      items,
      counts,
    };
  }
}
