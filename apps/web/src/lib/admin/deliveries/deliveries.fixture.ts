import type { DeliveriesPage, DeliveryView } from "@/lib/data/http/admin-deliveries.schema";

/** Made-up deliveries for tests and screenshots. No real people, places or sales. */
export const DELIVERY_FIXTURE_NOW = "2026-11-16T12:00:00.000Z";

const SALE = {
  id: "5a1e0000-0000-4000-8000-000000000001",
  title: "Modern British",
  endsAt: "2026-11-12T18:00:00.000Z",
};

export function deliveryFixture(overrides: Partial<DeliveryView> = {}): DeliveryView {
  return {
    lotId: "10700000-0000-4000-8000-000000000042",
    quoteId: "40070000-0000-4000-8000-000000000042",
    status: "waiting",
    closedReason: null,
    awaitingPayment: false,
    statusSince: "2026-11-14T10:12:00.000Z",
    destination: "12 Rue Exemple, 69002 Lyon, France",
    quote: {
      status: "requested",
      amountMinor: null,
      currency: "GBP",
      note: null,
      requestedAt: "2026-11-14T10:12:00.000Z",
      quotedAt: null,
      decidedAt: null,
      declineReason: null,
    },
    lot: {
      title: "Harbour at dusk",
      lotNumber: 42,
      imageUrl: null,
      dimensions: "61 × 76 cm, framed",
      hammerMinor: 125_000,
    },
    sale: SALE,
    buyer: {
      legalEntityId: "b0e00000-0000-4000-8000-000000000118",
      name: "Example Trading Ltd",
      paddleNumber: 118,
    },
    fulfilment: null,
    history: [{ kind: "requested", at: "2026-11-14T10:12:00.000Z", by: "buyer" }],
    ...overrides,
  };
}

/** Three buyers waiting for a price, as in the approved mockup. */
export const WAITING_DELIVERIES: DeliveryView[] = [
  deliveryFixture(),
  deliveryFixture({
    lotId: "10700000-0000-4000-8000-000000000007",
    quoteId: "40070000-0000-4000-8000-000000000007",
    statusSince: "2026-11-15T09:30:00.000Z",
    destination: "4 Example Lane, Cork, Ireland",
    quote: { ...deliveryFixture().quote, requestedAt: "2026-11-15T09:30:00.000Z" },
    lot: { ...deliveryFixture().lot, title: "Still life, blue jug", lotNumber: 7 },
    buyer: {
      legalEntityId: "b0e00000-0000-4000-8000-000000000204",
      name: "A. Sample",
      paddleNumber: 204,
    },
    history: [{ kind: "requested", at: "2026-11-15T09:30:00.000Z", by: "buyer" }],
  }),
  deliveryFixture({
    lotId: "10700000-0000-4000-8000-000000000113",
    quoteId: "40070000-0000-4000-8000-000000000113",
    statusSince: "2026-11-16T09:00:00.000Z",
    destination: "9 Sample Street, York, United Kingdom",
    quote: { ...deliveryFixture().quote, requestedAt: "2026-11-16T09:00:00.000Z" },
    lot: { ...deliveryFixture().lot, title: "Untitled (grey)", lotNumber: 113, dimensions: null },
    sale: {
      id: "5a1e0000-0000-4000-8000-000000000002",
      title: "Prints",
      endsAt: "2026-11-09T18:00:00.000Z",
    },
    buyer: {
      legalEntityId: "b0e00000-0000-4000-8000-000000000031",
      name: "Demo Collection",
      paddleNumber: 31,
    },
    history: [{ kind: "requested", at: "2026-11-16T09:00:00.000Z", by: "buyer" }],
  }),
];

/** A quote sent and waiting for the buyer: staff can change it. */
export const QUOTED = deliveryFixture({
  status: "quoted",
  statusSince: "2026-11-15T09:00:00.000Z",
  quote: {
    ...deliveryFixture().quote,
    status: "quoted",
    amountMinor: 18_000,
    note: "Insured, two-person delivery",
    quotedAt: "2026-11-15T09:00:00.000Z",
  },
  history: [
    { kind: "requested", at: "2026-11-14T10:12:00.000Z", by: "buyer" },
    { kind: "quoted", at: "2026-11-15T09:00:00.000Z", by: "staff" },
  ],
});

/** A booked delivery not paid for yet, and one with the courier. */
export const BOOKED_UNPAID = deliveryFixture({
  status: "to_dispatch",
  awaitingPayment: true,
  statusSince: "2026-11-15T12:30:00.000Z",
  quote: {
    ...deliveryFixture().quote,
    status: "accepted",
    amountMinor: 18_000,
    note: "Insured, two-person delivery",
    quotedAt: "2026-11-15T09:00:00.000Z",
    decidedAt: "2026-11-15T12:30:00.000Z",
  },
  history: [
    { kind: "requested", at: "2026-11-14T10:12:00.000Z", by: "buyer" },
    { kind: "quoted", at: "2026-11-15T09:00:00.000Z", by: "staff" },
    { kind: "accepted", at: "2026-11-15T12:30:00.000Z", by: "buyer" },
  ],
});

export const ON_THE_WAY = deliveryFixture({
  status: "on_the_way",
  // The dispatch time is not recorded: the API sends none rather than the record's last edit.
  statusSince: null,
  quote: BOOKED_UNPAID.quote,
  fulfilment: {
    status: "in_transit",
    method: "shipping",
    carrier: "Example Couriers",
    trackingNumber: "EX123456789GB",
    paidAt: "2026-11-15T13:00:00.000Z",
    collectedAt: null,
  },
  history: [...BOOKED_UNPAID.history, { kind: "dispatched", at: null, by: "staff" }],
});

/** A paid, released lot whose delivery was accepted: To dispatch, waiting to be shipped. */
export const TO_DISPATCH = deliveryFixture({
  lotId: "10700000-0000-4000-8000-000000000071",
  quoteId: "40070000-0000-4000-8000-000000000071",
  status: "to_dispatch",
  statusSince: "2026-11-15T12:30:00.000Z",
  quote: BOOKED_UNPAID.quote,
  lot: { ...deliveryFixture().lot, title: "Tide line", lotNumber: 71 },
  fulfilment: {
    status: "released",
    method: "shipping",
    carrier: null,
    trackingNumber: null,
    paidAt: "2026-11-15T13:00:00.000Z",
    collectedAt: null,
  },
  history: BOOKED_UNPAID.history,
});

/** Delivered to the buyer's door: nothing left to do on Lot fulfilment. */
export const DELIVERED = deliveryFixture({
  lotId: "10700000-0000-4000-8000-000000000072",
  quoteId: "40070000-0000-4000-8000-000000000072",
  status: "delivered",
  statusSince: null,
  quote: BOOKED_UNPAID.quote,
  lot: { ...deliveryFixture().lot, title: "Salt marsh", lotNumber: 72 },
  fulfilment: {
    ...(ON_THE_WAY.fulfilment as NonNullable<DeliveryView["fulfilment"]>),
    status: "delivered",
  },
  history: [...ON_THE_WAY.history, { kind: "delivered", at: null, by: "staff" }],
});

/** Bought with a courier quote, then collected in person: closed, not delivered. */
export const COLLECTED = deliveryFixture({
  lotId: "10700000-0000-4000-8000-000000000051",
  quoteId: "40070000-0000-4000-8000-000000000051",
  status: "closed",
  closedReason: "collected",
  statusSince: "2026-11-16T11:00:00.000Z",
  quote: BOOKED_UNPAID.quote,
  lot: { ...deliveryFixture().lot, title: "Quay in winter", lotNumber: 51 },
  fulfilment: {
    status: "delivered",
    method: "collection",
    carrier: null,
    trackingNumber: null,
    paidAt: "2026-11-15T13:00:00.000Z",
    collectedAt: "2026-11-16T11:00:00.000Z",
  },
  history: [
    ...BOOKED_UNPAID.history,
    { kind: "collected", at: "2026-11-16T11:00:00.000Z", by: "buyer" },
  ],
});

/** A booked delivery whose purchase was refunded: closed as cancelled, with no recorded time. */
export const REFUNDED = deliveryFixture({
  lotId: "10700000-0000-4000-8000-000000000064",
  quoteId: "40070000-0000-4000-8000-000000000064",
  status: "closed",
  closedReason: "cancelled",
  statusSince: null,
  quote: BOOKED_UNPAID.quote,
  lot: { ...deliveryFixture().lot, title: "Orchard study", lotNumber: 64 },
  history: [...BOOKED_UNPAID.history, { kind: "cancelled", at: null, by: "staff" }],
});

const COUNTS = { waiting: 3, quoted: 1, to_dispatch: 1, on_the_way: 1, delivered: 4, closed: 2 };

export function deliveriesPageFixture(overrides: Partial<DeliveriesPage> = {}): DeliveriesPage {
  return {
    items: WAITING_DELIVERIES,
    total: WAITING_DELIVERIES.length,
    offset: 0,
    limit: 50,
    counts: COUNTS,
    sales: [
      { id: SALE.id, title: SALE.title },
      { id: "5a1e0000-0000-4000-8000-000000000002", title: "Prints" },
    ],
    ...overrides,
  };
}

/** A request the team declined ("Can't deliver", D8): closed, with the reason the buyer was told. */
export const DECLINED = deliveryFixture({
  lotId: "10700000-0000-4000-8000-000000000063",
  quoteId: "40070000-0000-4000-8000-000000000063",
  status: "closed",
  closedReason: "withdrawn",
  statusSince: "2026-11-15T16:00:00.000Z",
  quote: {
    ...deliveryFixture().quote,
    status: "withdrawn",
    decidedAt: "2026-11-15T16:00:00.000Z",
    declineReason: "We can't insure a framed work of this size to Lyon.",
  },
  lot: { ...deliveryFixture().lot, title: "Estuary at noon", lotNumber: 63 },
  history: [
    { kind: "requested", at: "2026-11-14T10:12:00.000Z", by: "buyer" },
    { kind: "withdrawn", at: "2026-11-15T16:00:00.000Z", by: "staff" },
  ],
});
