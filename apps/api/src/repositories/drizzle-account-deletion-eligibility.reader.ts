import { lotNotDeleted } from "@auction/db";
import type { Database } from "@auction/db";
import { legalEntityMember, lot, payment, payout, user as userTable } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { IAccountDeletionEligibilityReader } from "./interfaces/account-deletion-eligibility.reader.js";

export class DrizzleAccountDeletionEligibilityReader implements IAccountDeletionEligibilityReader {
  constructor(private readonly db: Database) {}

  async getDeletionRequestedAt(userId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ deletionRequestedAt: userTable.deletionRequestedAt })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    return row?.deletionRequestedAt ?? null;
  }

  async hasPendingPayment(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: payment.id })
      .from(payment)
      .where(and(eq(payment.buyerId, userId), eq(payment.status, "pending")))
      .limit(1);
    return Boolean(row);
  }

  async hasActiveSellerLot(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: lot.id })
      .from(lot)
      .innerJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, lot.sellerLegalEntityId),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .where(
        and(
          isNotNull(lot.sellerLegalEntityId),
          inArray(lot.status, ["draft", "scheduled", "active"]),
          lotNotDeleted(),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async listActiveMembershipEntityIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ legalEntityId: legalEntityMember.legalEntityId })
      .from(legalEntityMember)
      .where(and(eq(legalEntityMember.userId, userId), isNull(legalEntityMember.removedAt)));
    return rows.map((row) => row.legalEntityId).filter(Boolean);
  }

  async hasOpenPayoutForEntities(entityIds: string[]): Promise<boolean> {
    if (entityIds.length === 0) return false;
    const [row] = await this.db
      .select({ id: payout.id })
      .from(payout)
      .where(
        and(
          inArray(payout.legalEntityId, entityIds),
          inArray(payout.status, ["scheduled", "in_transit", "clawback_pending"]),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
