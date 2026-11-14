import { describe, expect, it } from "vitest";
import {
  ALL_LIVE_DOMAIN_EVENT_TYPES,
  DOMAIN_EVENT_REGISTRY,
  bidFirstForUserPayloadSchemaV1,
  bidOutbidPayloadSchemaV1,
  parseDomainEventPayload,
} from "./index.js";

describe("DOMAIN_EVENT_REGISTRY", () => {
  it("has a unique key per live event type", () => {
    const keys = Object.keys(DOMAIN_EVENT_REGISTRY);
    expect(keys.length).toBe(new Set(keys).size);
    expect(keys.sort()).toEqual([...ALL_LIVE_DOMAIN_EVENT_TYPES].sort());
  });

  it("parses v1 fixtures for newly frozen bid events", () => {
    const firstBid = {
      bidId: "11111111-1111-4111-8111-111111111111",
      lotId: "22222222-2222-4222-8222-222222222222",
      userId: "user_1",
      amountCents: 50_000,
      placedAt: "2026-07-21T12:00:00.000Z",
    };
    expect(parseDomainEventPayload("bid.first_for_user", 1, firstBid)).toEqual({
      ok: true,
      data: bidFirstForUserPayloadSchemaV1.parse(firstBid),
    });

    const outbid = {
      previousBidId: "33333333-3333-4333-8333-333333333333",
      lotId: "22222222-2222-4222-8222-222222222222",
      userId: "user_1",
      newHighAmountCents: 55_000,
    };
    expect(parseDomainEventPayload("bid.outbid", 1, outbid)).toEqual({
      ok: true,
      data: bidOutbidPayloadSchemaV1.parse(outbid),
    });
  });

  it("records Zoho catalogue changes for the audit trail, with the before and after of each field", () => {
    const payload = {
      schemaVersion: 1,
      registerId: "11111111-1111-4111-8111-111111111111",
      zohoProductId: "5000000000001000001",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      fields: ["title", "year"],
      changes: { title: { from: "Old", to: "New" }, year: { from: null, to: 2021 } },
    };
    const entry = DOMAIN_EVENT_REGISTRY["artwork_register.catalogue_changed"];
    expect(entry.consumers).toEqual(["audit"]);
    expect(entry.piiClassification).toBe("operational");
    expect(parseDomainEventPayload("artwork_register.catalogue_changed", 1, payload).ok).toBe(true);
    expect(
      parseDomainEventPayload("artwork_register.catalogue_changed", 1, {
        ...payload,
        fields: ["stockCode"],
      }).ok,
    ).toBe(false);
    expect(
      parseDomainEventPayload("artwork_register.catalogue_changed", 1, { ...payload, fields: [] })
        .ok,
    ).toBe(false);
  });

  it("routes artwork register events to the Zoho artwork writeback, and moves to the listing", () => {
    const base = {
      schemaVersion: 1,
      registerId: "11111111-1111-4111-8111-111111111111",
      zohoProductId: "5000000000001000001",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
    };
    for (const [type, payload] of [
      ["artwork_register.offer_changed", { ...base, fromState: "held", toState: "bid_sale" }],
      ["artwork_register.stock_code_assigned", base],
    ] as const) {
      expect(DOMAIN_EVENT_REGISTRY[type].consumers[0]).toBe("zoho_artwork_writeback");
      expect(DOMAIN_EVENT_REGISTRY[type].piiClassification).toBe("operational");
      expect(parseDomainEventPayload(type, 1, payload).ok).toBe(true);
    }
    expect(DOMAIN_EVENT_REGISTRY["artwork_register.offer_changed"].consumers).toEqual([
      "zoho_artwork_writeback",
      "zoho_artwork_listing",
    ]);
    expect(DOMAIN_EVENT_REGISTRY["artwork_register.stock_code_assigned"].consumers).toEqual([
      "zoho_artwork_writeback",
    ]);
    expect(
      parseDomainEventPayload("artwork_register.offer_changed", 1, {
        ...base,
        fromState: "held",
        toState: "nowhere",
      }).ok,
    ).toBe(false);
  });

  it("routes the print fulfilment events to the Zoho fulfilment consumer", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const fresh = [
      [
        "shop.print.pack_confirmed",
        { schemaVersion: 1, orderLineId: id, orderId: id, editionId: id },
      ],
      [
        "shop.print.swapped",
        { schemaVersion: 1, orderLineId: id, orderId: id, fromEditionId: id, toEditionId: other },
      ],
      [
        "shop.fulfilment.status_changed",
        { schemaVersion: 1, fulfilmentId: id, orderId: id, status: "in_transit" },
      ],
    ] as const;
    for (const [type, payload] of fresh) {
      const entry = DOMAIN_EVENT_REGISTRY[type];
      expect(entry.consumers).toEqual(["zoho_fulfilment"]);
      expect(entry.producers).toEqual(["shop-api"]);
      expect(entry.idempotencyPolicy).toBe("aggregate_event_unique");
      expect(entry.piiClassification).toBe("none");
      expect(parseDomainEventPayload(type, 1, payload).ok).toBe(true);
      expect(parseDomainEventPayload(type, 1, { ...payload, orderId: "not-a-uuid" }).ok).toBe(
        false,
      );
    }
    for (const type of [
      "shop.order.paid",
      "shop.editions.allocated",
      "shop.artwork.updated",
      "shop.edition.sold",
      "shop.edition.released",
      "shop.fulfilment.dispatched",
    ] as const) {
      expect(DOMAIN_EVENT_REGISTRY[type].consumers).toContain("zoho_fulfilment");
    }
  });

  it("accepts a shop.order.paid payload with or without a framing line count", () => {
    const base = {
      schemaVersion: 1,
      orderId: "33333333-3333-4333-8333-333333333333",
      identitySubjectId: "user_1",
      totalPence: 40500,
      paidAt: "2026-11-09T09:05:00.000Z",
      lineCount: 1,
    };
    expect(parseDomainEventPayload("shop.order.paid", 1, base).ok).toBe(true);
    const framed = parseDomainEventPayload("shop.order.paid", 1, { ...base, framingLineCount: 1 });
    expect(framed.ok).toBe(true);
    expect(
      parseDomainEventPayload("shop.order.paid", 1, { ...base, framingLineCount: -1 }).ok,
    ).toBe(false);
  });

  it("fails safely for unknown schema versions", () => {
    const result = parseDomainEventPayload("bid.outbid", 99, {
      previousBidId: "33333333-3333-4333-8333-333333333333",
      lotId: "22222222-2222-4222-8222-222222222222",
      userId: "user_1",
      newHighAmountCents: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Unsupported schema version 99");
    }
  });

  it("freezes sale.rescheduled as ids and instants, routed to the listing", () => {
    const payload = {
      saleId: "11111111-1111-4111-8111-111111111111",
      previousStartAt: "2026-11-10T10:00:00.000Z",
      newStartAt: "2026-11-12T10:00:00.000Z",
    };
    expect(parseDomainEventPayload("sale.rescheduled", 1, payload)).toEqual({
      ok: true,
      data: payload,
    });
    expect(
      parseDomainEventPayload("sale.rescheduled", 1, { ...payload, newStartAt: "tomorrow" }).ok,
    ).toBe(false);
    expect(DOMAIN_EVENT_REGISTRY["sale.rescheduled"].consumers).toContain("zoho_artwork_listing");
    expect(DOMAIN_EVENT_REGISTRY["sale.rescheduled"].piiClassification).toBe("none");
  });

  it("refreshes the Zoho listing when a lot is soft-deleted", () => {
    expect(DOMAIN_EVENT_REGISTRY["lot.soft_deleted"].consumers).toContain("zoho_artwork_listing");
  });
  it("routes Bid invoices, payments and refunds to the accounting consumer; invoice.raised is ids only", () => {
    const entry = DOMAIN_EVENT_REGISTRY["invoice.raised"];
    expect(entry.consumers).toEqual(["accounting"]);
    expect(entry.producers).toEqual(["packages/db"]);
    expect(entry.piiClassification).toBe("none");
    expect(DOMAIN_EVENT_REGISTRY["payment.captured"].consumers).toContain("accounting");
    expect(DOMAIN_EVENT_REGISTRY["payment.refunded"].consumers).toContain("accounting");
    const payload = {
      invoiceId: "11111111-1111-4111-8111-111111111111",
      lotId: "22222222-2222-4222-8222-222222222222",
      buyerLegalEntityId: "33333333-3333-4333-8333-333333333333",
      totalPence: 154_320,
      raisedAt: "2026-11-12T10:00:00.000Z",
    };
    expect(parseDomainEventPayload("invoice.raised", 1, payload)).toEqual({
      ok: true,
      data: payload,
    });
    // Matches the invoice table's own check (total > 0): a 0p Bid invoice cannot be raised.
    expect(parseDomainEventPayload("invoice.raised", 1, { ...payload, totalPence: 0 }).ok).toBe(
      false,
    );
    expect(parseDomainEventPayload("invoice.raised", 1, { ...payload, totalPence: 1 }).ok).toBe(
      true,
    );
  });

  it("routes a settled Pay several payment to the accounting consumer; references only", () => {
    const entry = DOMAIN_EVENT_REGISTRY["payment_group.settled"];
    expect(entry.consumers).toEqual(["accounting"]);
    expect(entry.producers).toEqual(["apps/api"]);
    expect(entry.piiClassification).toBe("none");
    const payload = {
      paymentGroupId: "11111111-1111-4111-8111-111111111111",
      buyerLegalEntityId: "22222222-2222-4222-8222-222222222222",
      paymentIds: ["33333333-3333-4333-8333-333333333333"],
      deliveryQuoteIds: [],
      settledAt: "2026-11-14T10:00:00.000Z",
    };
    expect(parseDomainEventPayload("payment_group.settled", 1, payload)).toEqual({
      ok: true,
      data: payload,
    });
    // No amounts and no names: the books read them from the stored rows.
    expect(
      parseDomainEventPayload("payment_group.settled", 1, { ...payload, paymentIds: [] }).ok,
    ).toBe(false);
    expect(
      Object.keys(
        (
          parseDomainEventPayload("payment_group.settled", 1, { ...payload, total: "10.00" }) as {
            data: object;
          }
        ).data,
      ),
    ).not.toContain("total");
  });
});
