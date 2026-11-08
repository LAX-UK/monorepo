import { lotNotDeleted } from "@auction/db";
import type { Database } from "@auction/db";
import { legalEntityMember, lot, payment, payout } from "@auction/db/schema";
import type { PayoutStatus } from "@auction/types";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { IAccountDeletionEligibilityReader } from "../interfaces/account-deletion-eligibility.reader.js";

/**
 * Payouts whose money is not settled with the seller. `transfer_blocked` and `failed` mean a
 * transfer may or may not exist at Stripe and staff still have to resolve it, so the account
 * cannot be deleted until they do.
 */
export const PAYOUT_STATUSES_BLOCKING_DELETION = [
  "scheduled",
  "in_transit",
  "clawback_pending",
  "transfer_blocked",
  "failed",
] as const satisfies readonly PayoutStatus[];

export class DrizzleAccountDeletionEligibilityReader implements IAccountDeletionEligibilityReader {
  constructor(private readonly db: Database) {}

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
          inArray(payout.status, [...PAYOUT_STATUSES_BLOCKING_DELETION]),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
