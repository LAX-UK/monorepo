import type { Database } from "@auction/db";
import { shopPayeeCompliance, shopPayoutLedger } from "@auction/db/schema";
import { evaluatePayoutEligibility } from "@auction/shop-domain";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

/** Skeleton: evaluates pending ledger rows; full write path deferred to finance slice. */
export function createPayoutEligibilityTask(db: Database): ShopSchedulerTask {
  return {
    name: "payout-eligibility",
    run: async (now) => {
      const pending = await db
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
        .limit(100);

      for (const row of pending) {
        const [compliance] = await db
          .select({ status: shopPayeeCompliance.status })
          .from(shopPayeeCompliance)
          .where(eq(shopPayeeCompliance.partyId, row.ownerPartyId))
          .limit(1);
        const payeeComplianceBlocked = compliance?.status === "blocked";
        const decision = evaluatePayoutEligibility({
          status: row.status,
          blockedReason: row.blockedReason,
          cancellationPeriodEndsAt: row.cancellationPeriodEndsAt,
          fundsAvailableAt: row.fundsAvailableAt,
          payeeComplianceBlocked,
          now,
        });
        if (decision.eligible) {
          await db
            .update(shopPayoutLedger)
            .set({ status: "due" })
            .where(eq(shopPayoutLedger.id, row.id));
        }
      }
    },
  };
}
