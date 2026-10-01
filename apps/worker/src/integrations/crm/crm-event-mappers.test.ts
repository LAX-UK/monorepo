import { describe, expect, it } from "vitest";
import { mapDomainEventToCrmIntent } from "./crm-event-mappers.js";
import { CRM_FIELD, CRM_LEAD_SOURCE_PLATFORM } from "./crm-field-constants.js";

const ctx = {
  auctionPipeline: "LAX Auction Pipeline",
  dealStageLotWon: "Closed Won",
  dealStagePaymentCaptured: "Closed Won",
  dealStagePaymentRefunded: "Closed Lost",
  dealStageShopPaid: "Closed Won",
  dealStageShopEnquiry: "Qualification",
};

describe("mapDomainEventToCrmIntent", () => {
  it("maps user.registered to Lead fields with LAX Platform source", () => {
    const intent = mapDomainEventToCrmIntent(
      {
        id: 1,
        eventType: "user.registered",
        aggregateId: "u1",
        schemaVersion: 1,
        payload: {
          userId: "u1",
          email: "a@example.com",
          name: "Ada Lovelace",
          source: "google",
        },
      },
      ctx,
    );
    expect(intent.kind).toBe("person_upsert");
    if (intent.kind === "person_upsert") {
      expect(intent.fields[CRM_FIELD.leadSource]).toBe(CRM_LEAD_SOURCE_PLATFORM);
      expect(intent.fields[CRM_FIELD.subjectExternalId]).toBe("u1");
      expect(intent.fields.Last_Name).toBe("Lovelace");
    }
  });

  it("skips empty profile patches", () => {
    const intent = mapDomainEventToCrmIntent(
      {
        id: 2,
        eventType: "user.profile_updated",
        aggregateId: "u1",
        schemaVersion: 1,
        payload: { schemaVersion: 1, subjectId: "u1", updatedAt: "2026-01-01T00:00:00Z" },
      },
      ctx,
    );
    expect(intent).toEqual({ kind: "skip", reason: "empty_profile_patch" });
  });

  it("maps payment.refunded admin payload when lot id is resolved externally", () => {
    const lotId = "11111111-1111-4111-8111-111111111111";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 3,
        eventType: "payment.refunded",
        aggregateId: "pay-1",
        schemaVersion: 1,
        payload: {
          amount: "10.00",
          currency: "GBP",
          sellerLegalEntityId: null,
          via: "admin_manual",
          stripeRefundId: null,
        },
      },
      ctx,
      { paymentRefundLotId: lotId },
    );
    expect(intent).toEqual({
      kind: "deal_stage",
      dealEntityId: `lot-won:${lotId}`,
      stage: ctx.dealStagePaymentRefunded,
    });
  });

  it("uses subject-specific deal entity id for shop original enquiries", () => {
    const artworkId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const subjectId = "subject-enquirer-1";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 10,
        eventType: "shop.artwork.interest_registered",
        aggregateId: artworkId,
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          artworkId,
          identitySubjectId: subjectId,
          intent: "enquiry",
        },
      },
      ctx,
    );
    expect(intent.kind).toBe("deal_upsert");
    if (intent.kind === "deal_upsert") {
      const dealKey = `shop-enquiry:${artworkId}:${subjectId}`;
      expect(intent.dealKey).toBe(dealKey);
      expect(intent.dealEntityId).toBe(dealKey);
    }
  });

  it("maps payment.refunded webhook payload when lot id is resolved externally", () => {
    const lotId = "22222222-2222-4222-8222-222222222222";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 4,
        eventType: "payment.refunded",
        aggregateId: "pay-2",
        schemaVersion: 1,
        payload: {
          stripeChargeId: "ch_1",
          amountCents: 500,
          cumulativeRefundedCents: 500,
          currency: "gbp",
          sellerLegalEntityId: "33333333-3333-4333-8333-333333333333",
          via: "stripe_webhook",
        },
      },
      ctx,
      { paymentRefundLotId: lotId },
    );
    expect(intent.kind).toBe("deal_stage");
  });
});
