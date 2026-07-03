import type { Database } from "@auction/db";
import { legalEntity, lot, payment, user } from "@auction/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import type { IAdminManualReviewPaymentReader } from "../interfaces/admin-manual-review-payment.reader.js";
import type { ManualReviewPaymentBaseRow } from "../interfaces/admin-read-models.js";

export class DrizzleAdminManualReviewPaymentReader implements IAdminManualReviewPaymentReader {
  constructor(private readonly db: Database) {}

  async listManualReviewPaymentRows(): Promise<ManualReviewPaymentBaseRow[]> {
    return this.db
      .select({
        paymentId: payment.id,
        lotId: payment.lotId,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        winnerUserId: payment.buyerId,
        winnerEmail: user.email,
        sellerLegalEntityId: payment.sellerLegalEntityId,
        sellerDisplayName: legalEntity.displayName,
        sellerStatus: legalEntity.status,
        sellerArchivedAt: legalEntity.statusChangedAt,
        amount: payment.amount,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .innerJoin(legalEntity, eq(payment.sellerLegalEntityId, legalEntity.id))
      .innerJoin(user, eq(payment.buyerId, user.id))
      .where(sql`${payment.status} = 'requires_manual_review'`)
      .orderBy(desc(payment.createdAt))
      .limit(100);
  }

  async countManualReviewPayments(): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .where(sql`${payment.status} = 'requires_manual_review'`);
    return row?.n ?? 0;
  }
}
