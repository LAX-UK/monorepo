import type { OrderLineRecord, OrderRecord } from "../application/ports/commerce.ports.js";

export function sampleOrderLine(overrides: Partial<OrderLineRecord> = {}): OrderLineRecord {
  return {
    orderLineId: "550e8400-e29b-41d4-a716-846655440002",
    artworkSlug: "warm-basket",
    artworkTitle: "Warm Basket",
    artistName: "Emmett King",
    productVariantId: null,
    productSlug: null,
    productTitle: null,
    variantSku: null,
    editionNumber: null,
    editionSize: 24,
    unitPricePence: 12_000,
    vatRateBp: 2000,
    imageUrl: null,
    ...overrides,
  };
}

export function sampleOrderRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    orderId: "550e8400-e29b-41d4-a716-846655440001",
    reference: "LAX-S-10482",
    status: "paid",
    fulfilment: "uk_insured_delivery",
    merchandiseSubtotalPence: 12_000,
    fulfilmentSurchargePence: 1500,
    totalPence: 13_500,
    refundedPence: 0,
    lines: [sampleOrderLine()],
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    paidAt: new Date("2026-10-01T09:05:00.000Z"),
    checkoutExpiresAt: null,
    refundPeriodEndsAt: null,
    deliveryAddress: {
      recipientName: "Robert Thorne",
      line1: "12 Elm Row",
      city: "Edinburgh",
      postcode: "EH7 4AA",
      country: "GB",
    },
    progress: null,
    refunds: [],
    ...overrides,
  };
}
