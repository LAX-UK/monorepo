import type { Database } from "@auction/db";
import {
  bidUserProfile,
  legalEntity,
  legalEntityMember,
  lot,
  payment,
  user,
} from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { IPaymentRefundNotifyReader } from "../interfaces/payment-refund-notify.reader.js";

export class DrizzlePaymentRefundNotifyReader implements IPaymentRefundNotifyReader {
  constructor(private readonly db: Database) {}

  async getRefundContext(paymentId: string, sellerLegalEntityId: string) {
    const [paymentRow] = await this.db
      .select({
        lotId: payment.lotId,
      })
      .from(payment)
      .where(eq(payment.id, paymentId))
      .limit(1);
    if (!paymentRow) return null;

    const [lotRow] = await this.db
      .select({
        title: lot.title,
        lotNumber: lot.lotNumber,
      })
      .from(lot)
      .where(eq(lot.id, paymentRow.lotId))
      .limit(1);

    const [entityRow] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, sellerLegalEntityId))
      .limit(1);

    const sellerMembers = await this.db
      .selectDistinct({
        email: user.email,
        userId: user.id,
        firstName: sql<string | null>`coalesce(${bidUserProfile.firstName}, ${user.name})`,
      })
      .from(legalEntityMember)
      .innerJoin(user, eq(user.id, legalEntityMember.userId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, sellerLegalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          or(
            inArray(legalEntityMember.role, ["owner", "admin"]),
            eq(legalEntityMember.isPrimaryAdmin, true),
          ),
        ),
      );

    return {
      lotTitle: lotRow?.title ?? "Unknown Lot",
      lotReference: lotRow?.lotNumber != null ? String(lotRow.lotNumber) : null,
      entityName: entityRow?.displayName ?? "Unknown Organisation",
      sellerMembers,
    };
  }
}
