import * as schema from "../../../schema/index.js";
import { loadPaidPurchase } from "./paid-purchase.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_ANCHORS, QUEUE_IDS } from "./queue-ids.js";

const DAY = 86_400_000;

/** Finance: a card dispute that has not yet been matched to the invoice it belongs to. */
export const disputeSeeder: QueueSeeder = {
  queue: "Disputes",
  async seed({ db, now }: QueueContext) {
    const purchase = await loadPaidPurchase(db, QUEUE_ANCHORS.disputedLot);
    const caseId = QUEUE_IDS.disputeCase(1);
    const openedAt = new Date(now - 2 * DAY);
    await db
      .insert(schema.disputeCase)
      .values({
        id: caseId,
        stripeDisputeId: "dp_demo_example_0001",
        stripeChargeId: "ch_demo_example_0001",
        amountPence: 552_000,
        currency: "GBP",
        reason: "product_not_received",
        status: "needs_response",
        dueBy: new Date(now + 12 * DAY),
        chargeRefundable: false,
        allocationState: "needs_allocation",
        stripeCreatedAt: openedAt,
        lastEventAt: openedAt,
      })
      .onConflictDoUpdate({
        target: schema.disputeCase.id,
        set: { dueBy: new Date(now + 12 * DAY) },
      });
    await db
      .insert(schema.disputeCaseCandidate)
      .values({ caseId, paymentId: purchase.paymentId })
      .onConflictDoNothing();
  },
};
