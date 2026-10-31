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

  it("maps a guest checkout lead to a CRM lead keyed by the guest, with its source and consent", () => {
    const guestId = "6f1c3c2a-1d2b-4c3e-9f4a-5b6c7d8e9f01";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 10,
        eventType: "shop.guest_lead.recorded",
        aggregateId: guestId,
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          guestCustomerId: guestId,
          leadSubjectId: `guest:${guestId}`,
          email: "ada@example.com",
          name: null,
          status: "abandoned_checkout",
          source: "Shop guest checkout",
          marketingConsent: false,
          marketingConsentAt: null,
          marketingConsentVersion: null,
          firstSeenAt: "2026-10-30T12:00:00.000Z",
          lastSeenAt: "2026-10-30T12:00:00.000Z",
          paidOrderCount: 0,
        },
      },
      ctx,
    );
    expect(intent.kind).toBe("person_upsert");
    if (intent.kind === "person_upsert") {
      expect(intent.subjectId).toBe(`guest:${guestId}`);
      expect(intent.fields[CRM_FIELD.leadSource]).toBe(CRM_LEAD_SOURCE_PLATFORM);
      expect(intent.fields[CRM_FIELD.leadSourceDetailed]).toBe(
        "Shop guest checkout: abandoned checkout",
      );
      expect(intent.fields[CRM_FIELD.emailOptOut]).toBe(true);
    }
  });

  it("labels a lead that has only sent an enquiry", () => {
    const guestId = "6f1c3c2a-1d2b-4c3e-9f4a-5b6c7d8e9f01";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 13,
        eventType: "shop.guest_lead.recorded",
        aggregateId: guestId,
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          guestCustomerId: guestId,
          leadSubjectId: `guest:${guestId}`,
          email: "ada@example.com",
          name: "Ada Moreno",
          status: "enquired",
          source: "lax.art enquiry",
          marketingConsent: false,
          marketingConsentAt: null,
          marketingConsentVersion: null,
          firstSeenAt: "2026-10-30T12:00:00.000Z",
          lastSeenAt: "2026-10-30T12:00:00.000Z",
          paidOrderCount: 0,
        },
      },
      ctx,
    );
    expect(intent.kind === "person_upsert" && intent.fields[CRM_FIELD.leadSourceDetailed]).toBe(
      "lax.art enquiry: enquired",
    );
  });

  it("merges a claimed guest lead into the account that verified the email", () => {
    const guestId = "6f1c3c2a-1d2b-4c3e-9f4a-5b6c7d8e9f01";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 11,
        eventType: "shop.guest_lead.claimed",
        aggregateId: guestId,
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          guestCustomerId: guestId,
          leadSubjectId: `guest:${guestId}`,
          subjectId: "user_1",
          claimedOrders: 2,
        },
      },
      ctx,
    );
    expect(intent).toEqual({
      kind: "merge_subjects",
      subjectId: "user_1",
      retiredSubjectId: `guest:${guestId}`,
    });
  });

  it("deletes the CRM lead of a guest erased on request", () => {
    const guestId = "6f1c3c2a-1d2b-4c3e-9f4a-5b6c7d8e9f01";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 12,
        eventType: "shop.guest_lead.erased",
        aggregateId: guestId,
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          guestCustomerId: guestId,
          leadSubjectId: `guest:${guestId}`,
          erasedAt: "2026-10-30T12:00:00.000Z",
        },
      },
      ctx,
    );
    expect(intent).toEqual({ kind: "erase_subject", subjectId: `guest:${guestId}` });
  });
});
