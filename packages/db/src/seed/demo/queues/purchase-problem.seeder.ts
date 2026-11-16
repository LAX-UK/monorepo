import * as schema from "../../../schema/index.js";
import { loadPaidPurchase } from "./paid-purchase.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_ANCHORS, QUEUE_IDS } from "./queue-ids.js";

const DAY = 86_400_000;

/** Work inbox, client services: a buyer says a paid lot has not arrived. */
export const purchaseProblemSeeder: QueueSeeder = {
  queue: "Purchase problems",
  async seed({ db, now, people }: QueueContext) {
    const purchase = await loadPaidPurchase(db, QUEUE_ANCHORS.paidLotInTransit);
    const problemId = QUEUE_IDS.purchaseProblem(1);
    await db
      .insert(schema.purchaseProblem)
      .values({
        id: problemId,
        lotId: purchase.lotId,
        buyerLegalEntityId: purchase.buyerEntityId,
        paymentId: purchase.paymentId,
        status: "open",
        category: "not_received",
        message:
          "The courier tracking has shown 'out for delivery' for four days and nothing has arrived. Could someone check with the carrier? (Demo data.)",
        reportedByUserId: people.collector,
        createdAt: new Date(now - 2 * DAY),
        updatedAt: new Date(now - 2 * DAY),
      })
      .onConflictDoNothing();
    await db
      .insert(schema.purchaseProblemNote)
      .values({
        id: QUEUE_IDS.purchaseProblemNote(1),
        purchaseProblemId: problemId,
        authorUserId: people.clientServices,
        body: "Asked the carrier for proof of delivery. Waiting for their reply (demo note).",
        createdAt: new Date(now - DAY),
      })
      .onConflictDoNothing();
  },
};
