import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, lot, payout, user } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { INotificationFanoutReader } from "../interfaces/notification-fanout.reader.js";

export class DrizzleNotificationFanoutReader implements INotificationFanoutReader {
  constructor(private readonly db: Database) {}

  async listEntityRecipients(legalEntityId: string) {
    return this.db
      .selectDistinct({
        email: user.email,
        userId: user.id,
        firstName: user.firstName,
      })
      .from(legalEntityMember)
      .innerJoin(user, eq(user.id, legalEntityMember.userId))
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

  async getUserForProxyNotice(userId: string) {
    const [row] = await this.db
      .select({ email: user.email, name: user.name, firstName: user.firstName })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row ?? null;
  }

  async getWinnerContact(userId: string) {
    const [row] = await this.db
      .select({ email: user.email, firstName: user.firstName })
      .from(user)
      .where(eq(user.id, userId))
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
      .select({ email: user.email, name: user.name, firstName: user.firstName })
      .from(user)
      .where(eq(user.id, buyerUserId))
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
