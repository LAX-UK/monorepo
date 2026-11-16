import * as schema from "../../../schema/index.js";
import { DEMO_PEOPLE } from "../demo-topup-ids.js";
import { personalEntityOf } from "../demo-topup-seed.js";
import { loadPaidPurchase } from "./paid-purchase.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_ANCHORS, QUEUE_IDS } from "./queue-ids.js";

const DAY = 86_400_000;

/** Private sales: an offer waiting on the buyer, for the work the seller asked to sell privately. */
export const privateSaleSeeder: QueueSeeder = {
  queue: "Private sales",
  async seed({ db, now, people, staff, enquiryIds }: QueueContext) {
    const buyer = await loadPaidPurchase(db, QUEUE_ANCHORS.paidLotForBooking);
    const sellerEntityId = personalEntityOf(DEMO_PEOPLE.collector);
    const submissionId = QUEUE_IDS.submission(2);
    await db
      .insert(schema.itemSubmission)
      .values({
        id: submissionId,
        legalEntityId: sellerEntityId,
        title: "Bronze Hare, 3/9 (demo)",
        description: "A small cast bronze hare. Invented for the demo.",
        medium: "Bronze",
        status: "approved",
        reviewedBy: staff.adminUserId,
        reviewedAt: new Date(now - 5 * DAY),
        submittedByUserId: people.collector,
        createdAt: new Date(now - 6 * DAY),
        updatedAt: new Date(now - 5 * DAY),
      })
      .onConflictDoNothing();

    const dealId = QUEUE_IDS.privateSaleDeal(1);
    await db
      .insert(schema.privateSaleDeal)
      .values({
        id: dealId,
        stage: "offer",
        itemSubmissionId: submissionId,
        sourceEnquiryId: enquiryIds.sell,
        ownerUserId: people.specialist,
        priceMinor: 4_200_000,
        buyerFeeBps: 1_000,
        offerExpiresAt: new Date(now + 5 * DAY),
        createdAt: new Date(now - 3 * DAY),
        updatedAt: new Date(now - DAY),
      })
      .onConflictDoUpdate({
        target: schema.privateSaleDeal.id,
        set: { offerExpiresAt: new Date(now + 5 * DAY) },
      });
    await db
      .insert(schema.privateSaleDealParty)
      .values([
        {
          id: QUEUE_IDS.privateSaleParty(1),
          dealId,
          role: "seller",
          legalEntityId: sellerEntityId,
          actingUserId: people.collector,
        },
        {
          id: QUEUE_IDS.privateSaleParty(2),
          dealId,
          role: "buyer",
          legalEntityId: buyer.buyerEntityId,
          actingUserId: buyer.buyerUserId,
        },
      ])
      .onConflictDoNothing();
  },
};
