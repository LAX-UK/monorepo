import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import {
  buyerAgentAuthorisation,
  legalEntityMember,
  lot,
  saleRegistration,
  telephoneBidBooking,
} from "@auction/db/schema";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import type {
  IBidLotRulesReader,
  IBidMembershipReader,
  IBuyerAgentAuthorisationReader,
  IOperatorPlacementReader,
  ISaleRegistrationBidReader,
} from "../interfaces/bid-eligibility.readers.js";

export class DrizzleBidLotRulesReader implements IBidLotRulesReader {
  constructor(private readonly db: Database) {}

  async findLotBidRules(lotId: string) {
    const [row] = await this.db
      .select({
        saleId: lot.saleId,
        autoBidEnabled: lot.autoBidEnabled,
        minBidIncrement: lot.minBidIncrement,
        autoBidStepMin: lot.autoBidStepMin,
        autoBidStepMax: lot.autoBidStepMax,
        autoBidStepPresets: lot.autoBidStepPresets,
      })
      .from(lot)
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    return row
      ? {
          ...row,
          minBidIncrement: String(row.minBidIncrement),
          autoBidStepMin: row.autoBidStepMin == null ? null : String(row.autoBidStepMin),
          autoBidStepMax: row.autoBidStepMax == null ? null : String(row.autoBidStepMax),
          autoBidStepPresets: row.autoBidStepPresets ?? null,
        }
      : null;
  }
}

export class DrizzleBidMembershipReader implements IBidMembershipReader {
  constructor(private readonly db: Database) {}

  async findActiveMemberRole(userId: string, legalEntityId: string) {
    const [row] = await this.db
      .select({ role: legalEntityMember.role })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .limit(1);
    return row?.role ?? null;
  }
}

export class DrizzleOperatorPlacementReader implements IOperatorPlacementReader {
  constructor(private readonly db: Database) {}

  async findTelephoneBookingPlacement(bookingId: string) {
    const [row] = await this.db
      .select({ status: telephoneBidBooking.status, saleId: telephoneBidBooking.saleId })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, bookingId))
      .limit(1);
    return row?.saleId ? { saleId: row.saleId, status: row.status } : null;
  }

  async findTelephoneBookingCap(bookingId: string) {
    const [row] = await this.db
      .select({ reserveAltMax: telephoneBidBooking.reserveAltMax })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, bookingId))
      .limit(1);
    return row
      ? { reserveAltMax: row.reserveAltMax == null ? null : String(row.reserveAltMax) }
      : null;
  }

  async findPaddleRegistration(saleId: string, paddleNumber: number) {
    const [row] = await this.db
      .select({ bidLimit: saleRegistration.bidLimit, status: saleRegistration.status })
      .from(saleRegistration)
      .where(
        and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.paddleNumber, paddleNumber)),
      )
      .limit(1);
    return row
      ? { bidLimit: row.bidLimit == null ? null : String(row.bidLimit), status: row.status }
      : null;
  }
}

export class DrizzleSaleRegistrationBidReader implements ISaleRegistrationBidReader {
  constructor(private readonly db: Database) {}

  async findRegistration(saleId: string, userId: string, buyerLegalEntityId: string) {
    const [row] = await this.db
      .select({ status: saleRegistration.status, bidLimit: saleRegistration.bidLimit })
      .from(saleRegistration)
      .where(
        and(
          eq(saleRegistration.saleId, saleId),
          eq(saleRegistration.userId, userId),
          eq(saleRegistration.buyerLegalEntityId, buyerLegalEntityId),
        ),
      )
      .limit(1);
    return row
      ? { status: row.status, bidLimit: row.bidLimit == null ? null : String(row.bidLimit) }
      : null;
  }
}

export class DrizzleBuyerAgentAuthorisationReader implements IBuyerAgentAuthorisationReader {
  constructor(private readonly db: Database) {}

  async findActiveAuthorisations(input: {
    legalEntityId: string;
    userId: string;
    saleId: string | null;
    now: Date;
  }) {
    const rows = await this.db
      .select({
        saleId: buyerAgentAuthorisation.saleId,
        bidLimit: buyerAgentAuthorisation.bidLimit,
      })
      .from(buyerAgentAuthorisation)
      .where(
        and(
          eq(buyerAgentAuthorisation.legalEntityId, input.legalEntityId),
          eq(buyerAgentAuthorisation.userId, input.userId),
          eq(buyerAgentAuthorisation.status, "active"),
          lte(buyerAgentAuthorisation.validFrom, input.now),
          or(
            isNull(buyerAgentAuthorisation.validUntil),
            gt(buyerAgentAuthorisation.validUntil, input.now),
          ),
          input.saleId
            ? or(
                isNull(buyerAgentAuthorisation.saleId),
                eq(buyerAgentAuthorisation.saleId, input.saleId),
              )
            : isNull(buyerAgentAuthorisation.saleId),
        ),
      );
    return rows.map((row) => ({
      saleId: row.saleId,
      bidLimit: row.bidLimit == null ? null : String(row.bidLimit),
    }));
  }
}
