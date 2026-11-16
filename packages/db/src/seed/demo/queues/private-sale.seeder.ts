import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  dealCreatedEvent,
  dealPartyNamedEvent,
  dealStageChangedEvent,
  dealTermsChangedEvent,
} from "@auction/domain";
import * as schema from "../../../schema/index.js";
import { DEMO_PEOPLE } from "../demo-topup-ids.js";
import { personalEntityOf } from "../demo-topup-seed.js";
import type { QueueContext, QueueSeeder } from "./queue-context.js";
import { QUEUE_IDS } from "./queue-ids.js";
import { type SeedEvent, writeSeedEvents } from "./seed-events.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Private sales (`/admin/private-sales`, Active): a deal at the offer stage, waiting on the buyer.
 * It is written once, as the deal desk leaves it after these steps, each with its history row and
 * event:
 *
 * 1. A seller's private sale enquiry (the seed's own) is converted: the enquiry becomes
 *    `converted`, a draft work is made from it, the deal opens at `proposed` with the seller named.
 * 2. The specialist names the buyer and sets the price and how long the offer stands.
 * 3. The specialist opens the offer (`proposed` → `offer`).
 */
export const privateSaleSeeder: QueueSeeder = {
  queue: "Private sales",
  async seed({ db, now, people }: QueueContext) {
    const seller = {
      userId: people.collector,
      entityId: personalEntityOf(DEMO_PEOPLE.collector),
    };
    const buyer = { userId: people.payBuyer, entityId: personalEntityOf(DEMO_PEOPLE.payBuyer) };
    const specialist = people.specialist;
    const enquiryId = QUEUE_IDS.enquiry(1);
    const submissionId = QUEUE_IDS.submission(2);
    const dealId = QUEUE_IDS.privateSaleDeal(1);
    const askedAt = new Date(now - 6 * DAY);
    const convertedAt = new Date(now - 3 * DAY);
    const namedAt = new Date(now - 2 * DAY);
    const offeredAt = new Date(now - DAY);
    const work = {
      title: "Bronze Hare, 3/9 (demo)",
      description: "A small cast bronze hare. Invented for the demo.",
      medium: "Bronze",
    };

    const [enquiry] = await db
      .insert(schema.marketingEnquiry)
      .values({
        id: enquiryId,
        intent: "private_sale_sell",
        topic: "selling",
        name: `${DEMO_PEOPLE.collector.firstName} ${DEMO_PEOPLE.collector.lastName}`,
        email: DEMO_PEOPLE.collector.email,
        message:
          "I have a small bronze hare, number 3 of 9, that I would like to sell privately. (Demo enquiry.)",
        sourcePage: "/private-sales",
        userId: seller.userId,
        legalEntityId: seller.entityId,
        status: "converted",
        assignedToUserId: specialist,
        createdAt: askedAt,
      })
      .onConflictDoNothing()
      .returning({ id: schema.marketingEnquiry.id });
    if (!enquiry) return;

    // The draft work the conversion makes from the enquiry.
    await db.insert(schema.itemSubmission).values({
      id: submissionId,
      legalEntityId: seller.entityId,
      title: work.title,
      description: work.description,
      medium: work.medium,
      status: "draft",
      submittedByUserId: seller.userId,
      createdAt: convertedAt,
      updatedAt: convertedAt,
    });

    const [deal] = await db
      .insert(schema.privateSaleDeal)
      .values({
        id: dealId,
        stage: "offer",
        itemSubmissionId: submissionId,
        sourceEnquiryId: enquiryId,
        ownerUserId: specialist,
        artworkUnlinkedReason: "sellers_own_work",
        priceMinor: 4_200_000,
        buyerFeeBps: 1_000,
        offerExpiresAt: new Date(now + 5 * DAY),
        createdAt: convertedAt,
        updatedAt: offeredAt,
      })
      .returning({ id: schema.privateSaleDeal.id, reference: schema.privateSaleDeal.reference });
    if (!deal) throw new Error("[demo-queues] the demo private sale deal was not written");

    await db.insert(schema.privateSaleDealParty).values([
      {
        id: QUEUE_IDS.privateSaleParty(1),
        dealId,
        role: "seller",
        legalEntityId: seller.entityId,
        actingUserId: seller.userId,
      },
      {
        id: QUEUE_IDS.privateSaleParty(2),
        dealId,
        role: "buyer",
        legalEntityId: buyer.entityId,
        actingUserId: buyer.userId,
      },
    ]);
    await db.insert(schema.privateSaleDealPartyHistory).values([
      {
        dealId,
        role: "seller",
        legalEntityId: seller.entityId,
        actingUserId: seller.userId,
        namedAt: convertedAt,
      },
      {
        dealId,
        role: "buyer",
        legalEntityId: buyer.entityId,
        actingUserId: buyer.userId,
        namedAt,
      },
    ]);
    await db.insert(schema.privateSaleDealStageHistory).values([
      {
        dealId,
        fromStage: null,
        toStage: "proposed",
        actorUserId: specialist,
        createdAt: convertedAt,
      },
      {
        dealId,
        fromStage: "proposed",
        toStage: "offer",
        actorUserId: specialist,
        createdAt: offeredAt,
      },
    ]);

    const ref = { id: dealId, reference: deal.reference };
    const created = dealCreatedEvent(ref);
    const named = dealPartyNamedEvent(ref, { role: "buyer", actingUserId: buyer.userId });
    const terms = dealTermsChangedEvent(ref, ["priceMinor", "buyerFeeBps", "offerExpiresAt"]);
    const opened = dealStageChangedEvent(ref, { from: "proposed", to: "offer" });
    const dealEvent = (
      eventType: string,
      payload: Record<string, unknown>,
      occurredAt: Date,
    ): SeedEvent => ({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: dealId,
      eventType,
      payload,
      actorUserId: specialist,
      actingLegalEntityId: null,
      occurredAt,
    });
    await writeSeedEvents(db, [
      dealEvent(created.eventType, created.payload, convertedAt),
      {
        aggregateType: "marketing_enquiry",
        aggregateId: enquiryId,
        eventType: "marketing_enquiry.converted",
        payload: { enquiryId, intent: "private_sale_sell", from: "in_progress" },
        actorUserId: specialist,
        occurredAt: convertedAt,
      },
      dealEvent(named.eventType, named.payload, namedAt),
      dealEvent(terms.eventType, terms.payload, namedAt),
      dealEvent(opened.eventType, opened.payload, offeredAt),
    ]);
  },
};
