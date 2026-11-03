import type { Database } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  bidUserProfile,
  legalEntity,
  legalEntityMember,
  lot,
  payout,
  sale,
  telephoneBidBooking,
  watchlist,
} from "@auction/db/schema";
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type {
  INotificationFanoutReader,
  SaleCancelledPeople,
} from "../interfaces/notification-fanout.reader.js";

export class DrizzleNotificationFanoutReader implements INotificationFanoutReader {
  constructor(private readonly db: Database) {}

  async listEntityRecipients(legalEntityId: string) {
    return this.db
      .selectDistinct({
        email: bidIdentityDirectory.email,
        userId: bidIdentityDirectory.subjectId,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(legalEntityMember)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          or(
            inArray(legalEntityMember.role, ["owner", "admin", "finance"]),
            eq(legalEntityMember.isPrimaryAdmin, true),
          ),
        ),
      );
  }

  async listSaleCancelledPeople(
    lotIds: readonly string[],
    saleId: string,
  ): Promise<SaleCancelledPeople> {
    const ids = [...lotIds];
    const [bidders, telephoneClients, consignors, watchers] = await Promise.all([
      this.db
        .selectDistinctOn([bid.bidderId], {
          userId: bid.bidderId,
          legalEntityId: bid.buyerLegalEntityId,
        })
        .from(bid)
        .where(inArray(bid.lotId, ids))
        .orderBy(bid.bidderId, desc(bid.createdAt)),
      this.db
        .selectDistinctOn([telephoneBidBooking.userId], {
          userId: telephoneBidBooking.userId,
          legalEntityId: telephoneBidBooking.buyerLegalEntityId,
        })
        .from(telephoneBidBooking)
        .where(
          and(
            eq(telephoneBidBooking.saleId, saleId),
            inArray(telephoneBidBooking.status, ["requested", "confirmed", "in_progress"]),
          ),
        )
        .orderBy(telephoneBidBooking.userId, desc(telephoneBidBooking.createdAt)),
      this.db
        .selectDistinct({ legalEntityId: lot.sellerLegalEntityId })
        .from(lot)
        .where(and(inArray(lot.id, ids), isNotNull(lot.sellerLegalEntityId))),
      this.db
        .selectDistinct({ userId: watchlist.userId })
        .from(watchlist)
        .where(inArray(watchlist.lotId, ids)),
    ]);
    return {
      bidders,
      telephoneClients,
      consignorEntityIds: consignors.flatMap((c) => (c.legalEntityId ? [c.legalEntityId] : [])),
      watcherUserIds: watchers.map((w) => w.userId),
    };
  }

  async getEntityDisplayName(legalEntityId: string): Promise<string> {
    const [row] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    return row?.displayName ?? "Unknown Organisation";
  }

  async getPayoutAmounts(payoutId: string) {
    const [row] = await this.db
      .select({ netAmount: payout.netAmount, currency: payout.currency })
      .from(payout)
      .where(eq(payout.id, payoutId))
      .limit(1);
    return row ?? null;
  }

  async getLotForVoided(lotId: string) {
    const [row] = await this.db
      .select({
        title: lot.title,
        winnerId: lot.winnerId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
      })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!row) return null;
    return {
      title: row.title ?? "Unknown Lot",
      winnerId: row.winnerId,
      sellerLegalEntityId: row.sellerLegalEntityId,
    };
  }

  async getLotTitle(lotId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ title: lot.title })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    return row?.title ?? null;
  }

  async getSaleTitle(saleId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ title: sale.title })
      .from(sale)
      .where(eq(sale.id, saleId))
      .limit(1);
    return row?.title ?? null;
  }

  async getUserForProxyNotice(userId: string) {
    const [row] = await this.db
      .select({
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row ?? null;
  }

  async getWinnerContact(userId: string) {
    const [row] = await this.db
      .select({
        email: bidIdentityDirectory.email,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row ?? null;
  }

  async getManualReviewContext(lotId: string, buyerUserId: string, sellerLegalEntityId: string) {
    const [lotRow] = await this.db
      .select({ title: lot.title, lotNumber: lot.lotNumber })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    const [buyerRow] = await this.db
      .select({
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, buyerUserId))
      .limit(1);
    const [sellerRow] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, sellerLegalEntityId))
      .limit(1);

    return {
      lotTitle: lotRow?.title ?? "Unknown Lot",
      lotReference: lotRow?.lotNumber == null ? null : String(lotRow.lotNumber),
      buyerEmail: buyerRow?.email ?? null,
      buyerName: buyerRow?.firstName ?? buyerRow?.name ?? null,
      sellerEntityName: sellerRow?.displayName ?? "Unknown Organisation",
    };
  }
}
