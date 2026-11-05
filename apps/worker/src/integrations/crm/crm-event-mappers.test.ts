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

  describe("deal names", () => {
    const facts = {
      clientName: "Ann Mears",
      stockCode: "LAX-ORI-MP-GAC-26-0037",
      artworkKind: "original" as const,
      additionalWorks: 0,
      reference: null,
    };
    const name = (intent: ReturnType<typeof mapDomainEventToCrmIntent>) =>
      intent.kind === "convert_lead_on_win"
        ? intent.dealFields.Deal_Name
        : intent.kind === "deal_upsert"
          ? intent.fields.Deal_Name
          : undefined;

    const lotWon = {
      id: 20,
      eventType: "bid.lot_won",
      aggregateId: "lot-1",
      schemaVersion: 1,
      payload: {
        lotId: "44444444-4444-4444-8444-444444444444",
        userId: "u1",
        winningBidId: "55555555-5555-4555-8555-555555555555",
        amountCents: 120000,
        endedAt: "2026-02-14T15:00:00Z",
      },
    };

    it("names a won lot as an acquisition", () => {
      expect(name(mapDomainEventToCrmIntent(lotWon, ctx, { dealNaming: facts }))).toBe(
        "Mears — MP — LAX-ORI-MP-GAC-26-0037 — Acquisition — 2026-02",
      );
    });

    it("falls back to the lot id when the work has no stock code and the client no name", () => {
      const bare = { ...facts, clientName: null, stockCode: null, artworkKind: null };
      expect(name(mapDomainEventToCrmIntent(lotWon, ctx, { dealNaming: bare }))).toBe(
        "44444444-4444-4444-8444-444444444444 — Acquisition — 2026-02",
      );
      expect(name(mapDomainEventToCrmIntent(lotWon, ctx))).toBe(
        "44444444-4444-4444-8444-444444444444 — Acquisition — 2026-02",
      );
    });

    it("uses the London month of the lot ending", () => {
      const late = {
        ...lotWon,
        payload: { ...lotWon.payload, endedAt: "2026-03-31T23:30:00Z" },
      };
      expect(name(mapDomainEventToCrmIntent(late, ctx, { dealNaming: facts }))).toContain(
        "— 2026-04",
      );
    });

    const orderPaid = {
      id: 21,
      eventType: "shop.order.paid",
      aggregateId: "order-1",
      schemaVersion: 1,
      payload: {
        schemaVersion: 1,
        orderId: "66666666-6666-4666-8666-666666666666",
        identitySubjectId: "u1",
        totalPence: 4500,
        paidAt: "2026-02-14T15:00:00Z",
        lineCount: 3,
      },
    };

    it("names a print order after its first line with +N for the others", () => {
      const print = {
        ...facts,
        stockCode: "LAX-PRI-MP-GAC-26-0005",
        artworkKind: "print" as const,
        additionalWorks: 2,
        reference: "LAX-S-10482",
      };
      expect(name(mapDomainEventToCrmIntent(orderPaid, ctx, { dealNaming: print }))).toBe(
        "Mears — MP — LAX-PRI-MP-GAC-26-0005 +2 — Print Order — 2026-02",
      );
    });

    it("names a Shop sale of an original an acquisition", () => {
      expect(name(mapDomainEventToCrmIntent(orderPaid, ctx, { dealNaming: facts }))).toContain(
        "— Acquisition —",
      );
    });

    it("uses the order reference when the line has no register entry", () => {
      const merch = {
        clientName: "Ann Mears",
        stockCode: null,
        artworkKind: null,
        additionalWorks: 0,
        reference: "LAX-S-10482",
      };
      expect(name(mapDomainEventToCrmIntent(orderPaid, ctx, { dealNaming: merch }))).toBe(
        "Mears — LAX-S-10482 — Print Order — 2026-02",
      );
    });

    it("names a Shop original enquiry with the processing month", () => {
      const intent = mapDomainEventToCrmIntent(
        {
          id: 22,
          eventType: "shop.artwork.interest_registered",
          aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          schemaVersion: 1,
          payload: {
            schemaVersion: 1,
            artworkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            identitySubjectId: "u1",
            intent: "enquiry",
          },
        },
        ctx,
        { dealNaming: facts, now: new Date("2026-05-02T09:00:00Z") },
      );
      expect(name(intent)).toBe("Mears — MP — LAX-ORI-MP-GAC-26-0037 — Acquisition — 2026-05");
    });

    it("never puts an email address in a deal name", () => {
      const emailOnly = { ...facts, clientName: "ann@example.com" };
      expect(
        name(mapDomainEventToCrmIntent(orderPaid, ctx, { dealNaming: emailOnly })),
      ).not.toContain("@");
    });
  });
});
