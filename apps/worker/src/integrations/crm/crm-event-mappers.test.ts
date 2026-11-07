import { describe, expect, it } from "vitest";
import { mapDomainEventToCrmIntent } from "./crm-event-mappers.js";
import { CRM_FIELD } from "./crm-field-constants.js";

const ctx = {
  leadStatusNew: "New (Unassigned)",
  auctionPipeline: "LAX Auction Pipeline",
  dealStageLotWon: "Closed Won",
  dealStagePaymentCaptured: "Closed Won",
  dealStagePaymentRefunded: "Closed Lost",
  dealStageShopPaid: "Closed Won",
};

describe("mapDomainEventToCrmIntent", () => {
  it("maps user.registered to a New (Unassigned) website lead", () => {
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
      expect(intent.createOnlyFields).toEqual({
        [CRM_FIELD.leadStatus]: "New (Unassigned)",
        [CRM_FIELD.leadSource]: "Website",
      });
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.leadStatus);
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.leadSource);
      expect(intent.fields[CRM_FIELD.leadSourceDetailed]).toBe("LAX Account sign-up");
      expect(intent.fields[CRM_FIELD.enquiryType]).toBe("General");
      // A sign-up records no consent, so none is sent and the lead is never opted in.
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.consentMarketingOptIn);
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.consentTimestamp);
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

  describe("signed-in Shop original enquiry", () => {
    const artworkId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const subjectId = "subject-enquirer-1";
    const interest = (intent: string) => ({
      id: 10,
      eventType: "shop.artwork.interest_registered",
      aggregateId: artworkId,
      schemaVersion: 1,
      payload: { schemaVersion: 1, artworkId, identitySubjectId: subjectId, intent },
    });
    const shopEnquiry = {
      email: "ann@example.com",
      name: "Ann Mears",
      phone: "+447700900123",
      reference: "E-2001",
      artworkTitle: "Blue Study",
      artworkSlug: "blue-study",
      stockCode: "LAX-ORI-MP-GAC-26-0037",
    };

    it("creates a Lead keyed by the account, never a Deal", () => {
      const intent = mapDomainEventToCrmIntent(interest("enquiry"), ctx, { shopEnquiry });
      expect(intent.kind).toBe("person_upsert");
      if (intent.kind !== "person_upsert") return;
      expect(intent.subjectId).toBe(subjectId);
      expect(intent.email).toBe("ann@example.com");
      expect(intent.fields).toMatchObject({
        Email: "ann@example.com",
        First_Name: "Ann",
        Last_Name: "Mears",
        Phone: "+447700900123",
        Enquiry_Type: "Original",
        [CRM_FIELD.enquiryReference]: "E-2001",
        [CRM_FIELD.subjectExternalId]: subjectId,
      });
      expect(intent.createOnlyFields).toMatchObject({ Lead_Status: "New (Unassigned)" });
      expect(JSON.stringify(intent)).not.toContain("shop-enquiry:");
    });

    it("names the original: stock code, lax.art link and title", () => {
      const intent = mapDomainEventToCrmIntent(
        interest("enquiry"),
        { ...ctx, artPublicUrl: "https://lax.art/" },
        { shopEnquiry },
      );
      if (intent.kind !== "person_upsert") throw new Error("expected person_upsert");
      expect(intent.fields[CRM_FIELD.leadSourceDetailed]).toBe(
        "LAX Shop enquiry: LAX-ORI-MP-GAC-26-0037 https://lax.art/artworks/blue-study Blue Study",
      );
    });

    it("sends no link, not a relative one, when the lax.art origin is not set", () => {
      const intent = mapDomainEventToCrmIntent(interest("enquiry"), ctx, { shopEnquiry });
      if (intent.kind !== "person_upsert") throw new Error("expected person_upsert");
      expect(intent.fields[CRM_FIELD.leadSourceDetailed]).toBe(
        "LAX Shop enquiry: LAX-ORI-MP-GAC-26-0037 Blue Study",
      );
      expect(JSON.stringify(intent)).not.toContain("/artworks/");
    });

    it("sends no consent, so an existing opt-in is never overwritten", () => {
      const intent = mapDomainEventToCrmIntent(interest("enquiry"), ctx, { shopEnquiry });
      if (intent.kind !== "person_upsert") throw new Error("expected person_upsert");
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.emailOptOut);
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.consentMarketingOptIn);
    });

    it("skips when the sender or work is gone, and for notify-me interest", () => {
      expect(mapDomainEventToCrmIntent(interest("enquiry"), ctx, { shopEnquiry: null })).toEqual({
        kind: "skip",
        reason: "shop_enquiry_not_found",
      });
      expect(mapDomainEventToCrmIntent(interest("notify_me"), ctx, { shopEnquiry })).toEqual({
        kind: "skip",
        reason: "interest_not_enquiry",
      });
    });
  });

  it("maps a guest Shop enquiry to a Lead through the guest lead event", () => {
    const intent = mapDomainEventToCrmIntent(
      {
        id: 11,
        eventType: "shop.guest_lead.recorded",
        aggregateId: "guest-1",
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          guestCustomerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          leadSubjectId: "guest:1",
          email: "guest@example.com",
          name: "Gus Guest",
          status: "enquired",
          source: "art_enquiry",
          marketingConsent: false,
          marketingConsentAt: null,
          marketingConsentVersion: null,
          firstSeenAt: "2026-11-01T10:00:00Z",
          lastSeenAt: "2026-11-01T10:00:00Z",
          paidOrderCount: 0,
        },
      },
      ctx,
    );
    expect(intent.kind).toBe("person_upsert");
    if (intent.kind !== "person_upsert") return;
    expect(intent.subjectId).toBe("guest:1");
    expect(intent.fields.Enquiry_Type).toBe("Prints");
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
      expect(intent.createOnlyFields[CRM_FIELD.leadSource]).toBe("Website");
      expect(intent.fields[CRM_FIELD.leadSourceDetailed]).toBe(
        "LAX Shop guest Shop guest checkout: abandoned checkout",
      );
      expect(intent.fields[CRM_FIELD.enquiryType]).toBe("Prints");
      expect(intent.fields[CRM_FIELD.emailOptOut]).toBe(true);
      expect(intent.fields[CRM_FIELD.consentMarketingOptIn]).toBe(false);
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.consentTimestamp);
      expect(intent.fields).not.toHaveProperty(CRM_FIELD.consentSource);
      expect(intent.fields[CRM_FIELD.dataProcessingNoticeConfirmed]).toBe(true);
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
      "LAX Shop guest lax.art enquiry: enquired",
    );
  });

  it("carries the recorded consent of a guest who opted in", () => {
    const guestId = "6f1c3c2a-1d2b-4c3e-9f4a-5b6c7d8e9f01";
    const intent = mapDomainEventToCrmIntent(
      {
        id: 14,
        eventType: "shop.guest_lead.recorded",
        aggregateId: guestId,
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          guestCustomerId: guestId,
          leadSubjectId: `guest:${guestId}`,
          email: "ada@example.com",
          name: "Ada Moreno",
          status: "ordered",
          source: "Shop guest checkout",
          marketingConsent: true,
          marketingConsentAt: "2026-10-30T12:15:00.000Z",
          marketingConsentVersion: "2026-10",
          firstSeenAt: "2026-10-30T12:00:00.000Z",
          lastSeenAt: "2026-10-30T12:00:00.000Z",
          paidOrderCount: 1,
        },
      },
      ctx,
    );
    expect(intent.kind === "person_upsert" && intent.fields).toMatchObject({
      [CRM_FIELD.consentMarketingOptIn]: true,
      [CRM_FIELD.consentTimestamp]: "2026-10-30",
      [CRM_FIELD.consentSource]: "Website",
      [CRM_FIELD.consentWordingVersion]: "2026-10",
      [CRM_FIELD.emailOptOut]: false,
    });
  });

  it("holds a lot win as a purchase and marks the capture as the payment", () => {
    const lotId = "11111111-1111-4111-8111-111111111111";
    const won = mapDomainEventToCrmIntent(
      {
        id: 20,
        eventType: "bid.lot_won",
        aggregateId: lotId,
        schemaVersion: 1,
        payload: {
          lotId,
          userId: "u1",
          winningBidId: "22222222-2222-4222-8222-222222222222",
          amountCents: 125_000,
          endedAt: "2026-11-02T18:00:00.000Z",
        },
      },
      ctx,
    );
    expect(won.kind).toBe("deal_upsert");
    if (won.kind === "deal_upsert") {
      expect(won.purchase).toEqual({ product: "LAX Bid", paid: false });
      expect(won.dealEntityId).toBe(`lot-won:${lotId}`);
    }
    const paid = mapDomainEventToCrmIntent(
      {
        id: 21,
        eventType: "payment.captured",
        aggregateId: "pay-1",
        schemaVersion: 1,
        payload: {
          paymentId: "33333333-3333-4333-8333-333333333333",
          lotId,
          userId: "u1",
          amountCents: 125_000,
          capturedAt: "2026-11-04T09:00:00.000Z",
          via: "stripe_checkout_webhook",
        },
      },
      ctx,
    );
    expect(paid).toEqual({
      kind: "purchase_paid",
      dealEntityId: `lot-won:${lotId}`,
      stage: ctx.dealStagePaymentCaptured,
      amount: 1250,
      paidAt: "2026-11-04T09:00:00.000Z",
    });
  });

  it("marks a paid Shop order as a paid purchase", () => {
    const intent = mapDomainEventToCrmIntent(
      {
        id: 22,
        eventType: "shop.order.paid",
        aggregateId: "o1",
        schemaVersion: 1,
        payload: {
          schemaVersion: 1,
          orderId: "44444444-4444-4444-8444-444444444444",
          identitySubjectId: "u1",
          totalPence: 48_000,
          paidAt: "2026-11-03T10:00:00.000Z",
          lineCount: 1,
        },
      },
      ctx,
    );
    expect(intent.kind === "deal_upsert" && intent.purchase).toEqual({
      product: "LAX Shop",
      paid: true,
    });
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
      intent.kind === "deal_upsert" ? intent.fields.Deal_Name : undefined;

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

    it("never puts an email address in a deal name", () => {
      const emailOnly = { ...facts, clientName: "ann@example.com" };
      expect(
        name(mapDomainEventToCrmIntent(orderPaid, ctx, { dealNaming: emailOnly })),
      ).not.toContain("@");
    });
  });
});
