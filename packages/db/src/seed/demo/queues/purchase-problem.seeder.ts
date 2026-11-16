import * as schema from "../../../schema/index.js";
import { loadPaidPurchase } from "./paid-purchase.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_ANCHORS, QUEUE_IDS } from "./queue-ids.js";
import { writeSeedEvents } from "./seed-events.js";

const DAY = 86_400_000;

/**
 * Purchase problems (`/admin/purchase-problems`, Open) and the work inbox: the buyer of a paid lot
 * says it has not arrived. Written once, with the `purchase_problem.reported` event the report
 * service publishes; what staff do with it afterwards is left alone.
 */
export const purchaseProblemSeeder: QueueSeeder = {
  queue: "Purchase problems",
  async seed({ db, now }: QueueContext) {
    const purchase = await loadPaidPurchase(db, QUEUE_ANCHORS.paidLotInTransit);
    if (!purchase.buyerUserId) {
      throw new Error("[demo-queues] the paid lot for the purchase problem has no buyer");
    }
    const problemId = QUEUE_IDS.purchaseProblem(1);
    const reportedAt = new Date(now - 2 * DAY);
    const category = "not_received";
    const [created] = await db
      .insert(schema.purchaseProblem)
      .values({
        id: problemId,
        lotId: purchase.lotId,
        buyerLegalEntityId: purchase.buyerEntityId,
        paymentId: purchase.paymentId,
        status: "open",
        category,
        message:
          "The courier tracking has shown 'out for delivery' for four days and nothing has arrived. Could someone check with the carrier? (Demo data.)",
        reportedByUserId: purchase.buyerUserId,
        createdAt: reportedAt,
        updatedAt: reportedAt,
      })
      .onConflictDoNothing()
      .returning({ id: schema.purchaseProblem.id });
    if (!created) return;
    await writeSeedEvents(db, [
      {
        aggregateType: "purchase_problem",
        aggregateId: problemId,
        eventType: "purchase_problem.reported",
        payload: { lotId: purchase.lotId, paymentId: purchase.paymentId, category },
        actorUserId: purchase.buyerUserId,
        actingLegalEntityId: purchase.buyerEntityId,
        occurredAt: reportedAt,
      },
    ]);
  },
};
