import * as schema from "../../../schema/index.js";
import { ensureCollectionSale } from "./collection-sale.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { DEMO_STRIPE, QUEUE_IDS } from "./queue-ids.js";
import { writeSeedEvents } from "./seed-events.js";

const DAY = 86_400_000;
/** Where the Stripe dispute webhook's claims are kept (the recorder claims the event first). */
const PAYMENT_WEBHOOK_EVENT_SOURCE = "stripe_payment_webhook";

/**
 * Disputes (`/admin/disputes`, "Needs allocation"): a card dispute on a "Pay several" charge that
 * paid two invoices. With more than one candidate the recorder cannot allocate it by itself, so it
 * records the case as needing allocation, lists both invoices as candidates and announces it;
 * the seed writes the same rows and event. Staff split the disputed amount between the invoices.
 */
export const disputeSeeder: QueueSeeder = {
  queue: "Disputes",
  async seed(context: QueueContext) {
    const { db, now } = context;
    const sale = await ensureCollectionSale(context);
    const caseId = QUEUE_IDS.disputeCase(1);
    const openedAt = new Date(now - 2 * DAY);
    const amountPence = sale.groupPayments.reduce((sum, p) => sum + p.totalPence, 0);

    const [created] = await db
      .insert(schema.disputeCase)
      .values({
        id: caseId,
        stripeDisputeId: DEMO_STRIPE.dispute,
        stripeChargeId: DEMO_STRIPE.groupCharge,
        stripePaymentIntentId: DEMO_STRIPE.groupIntent,
        amountPence,
        currency: "GBP",
        reason: "product_not_received",
        status: "needs_response",
        dueBy: new Date(now + 12 * DAY),
        chargeRefundable: false,
        allocationState: "needs_allocation",
        stripeCreatedAt: openedAt,
        lastEventAt: openedAt,
        createdAt: openedAt,
        updatedAt: openedAt,
      })
      .onConflictDoNothing()
      .returning({ id: schema.disputeCase.id });
    if (!created) return;

    await db
      .insert(schema.processedStripeEvents)
      .values({ eventId: DEMO_STRIPE.disputeEvent, source: PAYMENT_WEBHOOK_EVENT_SOURCE })
      .onConflictDoNothing();
    await db
      .insert(schema.disputeCaseCandidate)
      .values(sale.groupPayments.map((p) => ({ caseId, paymentId: p.paymentId })));
    await writeSeedEvents(db, [
      {
        aggregateType: "dispute_case",
        aggregateId: caseId,
        eventType: "dispute_case.needs_allocation",
        payload: {
          disputeCaseId: caseId,
          stripeDisputeId: DEMO_STRIPE.dispute,
          stripeChargeId: DEMO_STRIPE.groupCharge,
          amountCents: amountPence,
          currency: "GBP",
          reason: "product_not_received",
          candidateCount: sale.groupPayments.length,
        },
        actorUserId: null,
        actingLegalEntityId: null,
        occurredAt: openedAt,
      },
    ]);
  },
};
