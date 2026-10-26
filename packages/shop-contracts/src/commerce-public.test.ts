import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { ORDER_STATUS_VALUES, OrderStatusSchema, OrderSummarySchema } from "./commerce-public.js";
import { parseOrderSummary, parseSavedDeliveryAddressList } from "./parse-public.js";

describe("OrderSummarySchema", () => {
  it("accepts a null delivery address", () => {
    const payload = {
      orderId: "550e8400-e29b-41d4-a716-846655440001",
      status: "paid" as const,
      fulfilment: "uk_insured_delivery" as const,
      merchandiseSubtotalPence: 100,
      fulfilmentSurchargePence: 0,
      totalPence: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: "2026-01-01T00:01:00.000Z",
      deliveryAddress: null,
      lines: [],
    };
    expect(Value.Check(OrderSummarySchema, payload)).toBe(true);
    expect(parseOrderSummary(payload).orderId).toBe(payload.orderId);
  });

  const base = {
    orderId: "550e8400-e29b-41d4-a716-846655440001",
    fulfilment: "uk_insured_delivery" as const,
    merchandiseSubtotalPence: 100,
    fulfilmentSurchargePence: 0,
    totalPence: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    paidAt: "2026-01-01T00:01:00.000Z",
    deliveryAddress: null,
    lines: [],
  };

  it.each(["refunded", "partially_refunded"] as const)("accepts a %s order", (status) => {
    const payload = { ...base, status, refundedPence: 40 };
    expect(Value.Check(OrderSummarySchema, payload)).toBe(true);
    expect(parseOrderSummary(payload).refundedPence).toBe(40);
  });

  it("treats the refunded amount as optional but never negative", () => {
    expect(Value.Check(OrderSummarySchema, { ...base, status: "paid" })).toBe(true);
    expect(Value.Check(OrderSummarySchema, { ...base, status: "paid", refundedPence: -1 })).toBe(
      false,
    );
  });

  it("rejects a status the contract does not know", () => {
    expect(Value.Check(OrderSummarySchema, { ...base, status: "disputed" })).toBe(false);
  });

  it("lists every status the schema accepts", () => {
    for (const status of ORDER_STATUS_VALUES) {
      expect(Value.Check(OrderStatusSchema, status)).toBe(true);
    }
  });

  it("accepts a delivery address with or without a recipient name, never an empty one", () => {
    const order = { ...base, status: "paid" as const };
    const address = { line1: "1 High Street", city: "London", postcode: "SW1A 1AA", country: "GB" };
    expect(Value.Check(OrderSummarySchema, { ...order, deliveryAddress: address })).toBe(true);
    expect(
      Value.Check(OrderSummarySchema, {
        ...order,
        deliveryAddress: { ...address, recipientName: "Ada Lovelace" },
      }),
    ).toBe(true);
    expect(
      Value.Check(OrderSummarySchema, {
        ...order,
        deliveryAddress: { ...address, recipientName: "" },
      }),
    ).toBe(false);
  });

  const line = {
    orderLineId: "550e8400-e29b-41d4-a716-846655440003",
    artworkSlug: "harbor-print",
    artworkTitle: "Harbor Print",
    productVariantId: null,
    productSlug: null,
    productTitle: null,
    variantSku: null,
    unitPricePence: 100,
  };

  it("accepts any edition number in the run, not only up to 24", () => {
    const order = { ...base, status: "paid" as const };
    for (const editionNumber of [1, 24, 25, 150]) {
      expect(
        Value.Check(OrderSummarySchema, {
          ...order,
          lines: [{ ...line, editionNumber, editionSize: 150 }],
        }),
      ).toBe(true);
    }
    expect(
      Value.Check(OrderSummarySchema, { ...order, lines: [{ ...line, editionNumber: 0 }] }),
    ).toBe(false);
  });

  it("accepts the reference, progress, refunds and problem window", () => {
    expect(
      Value.Check(OrderSummarySchema, {
        ...base,
        status: "partially_refunded",
        reference: "LAX-S-10482",
        checkoutExpiresAt: null,
        vatIncludedPence: 17,
        vatRateBp: 2000,
        progress: {
          status: "in_transit",
          carrier: "Royal Mail",
          trackingNumber: "AB123456789GB",
          trackingUrl: "https://www.royalmail.com/track-your-item",
          productionStartedAt: "2026-01-02T00:00:00.000Z",
          dispatchedAt: "2026-01-03T00:00:00.000Z",
          readyForCollectionAt: null,
          possessionAt: null,
          cancelledAt: null,
        },
        refunds: [
          {
            amountPence: 40,
            kind: "refund",
            status: "succeeded",
            requestedAt: "2026-01-04T00:00:00.000Z",
            refundedAt: "2026-01-05T00:00:00.000Z",
          },
        ],
        problemReport: { open: true, endsAt: null },
        invoiceAvailable: true,
      }),
    ).toBe(true);
  });
});

describe("parseSavedDeliveryAddressList", () => {
  const saved = {
    id: "550e8400-e29b-41d4-a716-846655440002",
    label: "Home",
    recipientName: "Ada Lovelace",
    line1: "1 High Street",
    line2: null,
    city: "London",
    postcode: "SW1A 1AA",
    country: "GB",
    phone: null,
    isDefaultShipping: true,
  };

  it("parses the list", () => {
    expect(
      parseSavedDeliveryAddressList({ available: true, addresses: [saved] }).addresses,
    ).toEqual([saved]);
  });

  it("refuses fields the contract does not name", () => {
    expect(() =>
      parseSavedDeliveryAddressList({ available: true, addresses: [{ ...saved, version: 1 }] }),
    ).toThrow();
  });
});
