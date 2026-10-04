import type { Database } from "@auction/db";
import { shopPayeeCompliance, shopPayoutLedger } from "@auction/db/schema";
import { evaluatePayoutEligibility, resolvePayeeComplianceStatus } from "@auction/shop-domain";
import { and, eq, isNull, lte, or } from "drizzle-orm";

export function createRunPayoutEligibilityHandler(db: Database): (now: Date) => Promise<number> {
  return async (now) =>
    db.transaction(async (tx) => {
      const pending = await tx
        .select({
          id: shopPayoutLedger.id,
          status: shopPayoutLedger.status,
          blockedReason: shopPayoutLedger.blockedReason,
          cancellationPeriodEndsAt: shopPayoutLedger.cancellationPeriodEndsAt,
          fundsAvailableAt: shopPayoutLedger.fundsAvailableAt,
          ownerPartyId: shopPayoutLedger.ownerPartyId,
        })
        .from(shopPayoutLedger)
        .where(
          and(
            eq(shopPayoutLedger.status, "pending_refund_period"),
            isNull(shopPayoutLedger.blockedReason),
            or(
              isNull(shopPayoutLedger.cancellationPeriodEndsAt),
              lte(shopPayoutLedger.cancellationPeriodEndsAt, now),
            ),
          ),
        )
        .limit(100)
        .for("update", { skipLocked: true });

      let updated = 0;
      for (const row of pending) {
        const [compliance] = await tx
          .select({ status: shopPayeeCompliance.status })
          .from(shopPayeeCompliance)
          .where(eq(shopPayeeCompliance.partyId, row.ownerPartyId))
          .limit(1);
        const decision = evaluatePayoutEligibility({
          status: row.status,
          blockedReason: row.blockedReason,
          cancellationPeriodEndsAt: row.cancellationPeriodEndsAt,
          fundsAvailableAt: row.fundsAvailableAt,
          payeeCompliance: resolvePayeeComplianceStatus(compliance),
          now,
        });
        if (!decision.eligible) {
          continue;
        }
        const result = await tx
          .update(shopPayoutLedger)
          .set({ status: "due" })
          .where(
            and(
              eq(shopPayoutLedger.id, row.id),
              eq(shopPayoutLedger.status, "pending_refund_period"),
              isNull(shopPayoutLedger.blockedReason),
            ),
          )
          .returning({ id: shopPayoutLedger.id });
        if (result.length === 1) {
          updated += 1;
        }
      }
      return updated;
    });
}
