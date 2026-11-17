import type { AdminDeliveryRecord, IAdminDeliveriesReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AdminDeliveriesService, deliveryHistory } from "./admin-deliveries.service.js";

const LOT = "11111111-1111-4111-8111-111111111111";
const SALE = "22222222-2222-4222-8222-222222222222";
const at = (iso: string) => new Date(iso);

function record(overrides: Partial<AdminDeliveryRecord> = {}): AdminDeliveryRecord {
  return {
    quoteId: "33333333-3333-4333-8333-333333333333",
    lotId: LOT,
    status: "waiting",
    closedReason: null,
    awaitingPayment: false,
    statusSince: at("2026-11-14T10:12:00Z"),
    quote: {
      status: "requested",
      destination: "12 Rue Exemple, 69002 Lyon, France",
      amount: null,
      currency: "GBP",
      note: null,
      requestedAt: at("2026-11-14T10:12:00Z"),
      quotedAt: null,
      decidedAt: null,
    },
    lot: {
      title: "Harbour at dusk",
      lotNumber: 42,
      imageUrl: null,
      dimensions: "61 × 76 cm",
      hammerPrice: "1250.00",
    },
    sale: { id: SALE, title: "Modern British", endsAt: at("2026-11-12T18:00:00Z") },
    buyer: {
      legalEntityId: "44444444-4444-4444-8444-444444444444",
      name: "Example Trading Ltd",
      paddleNumber: 118,
    },
    fulfilment: null,
    ...overrides,
  };
}

function reader(rows: AdminDeliveryRecord[] = [record()]) {
  return {
    list: vi.fn().mockResolvedValue({ rows, total: rows.length }),
    counts: vi.fn().mockResolvedValue({
      waiting: 3,
      quoted: 1,
      to_dispatch: 0,
      on_the_way: 2,
      delivered: 5,
      closed: 1,
    }),
    sales: vi.fn().mockResolvedValue([{ id: SALE, title: "Modern British" }]),
    findByLotId: vi.fn().mockResolvedValue(rows[0] ?? null),
  } satisfies IAdminDeliveriesReader;
}

describe("AdminDeliveriesService", () => {
  it("lists a view with counts for the same search and sale, and the sales to filter by", async () => {
    const fake = reader();
    const page = await new AdminDeliveriesService(fake).list({
      view: "waiting",
      q: "Lyon",
      saleId: SALE,
      sort: "oldest",
      limit: 50,
      offset: 0,
    });
    expect(fake.list).toHaveBeenCalledWith({
      search: "Lyon",
      saleId: SALE,
      status: "waiting",
      sort: "oldest",
      limit: 50,
      offset: 0,
    });
    expect(fake.counts).toHaveBeenCalledWith({ search: "Lyon", saleId: SALE });
    expect(page).toMatchObject({
      total: 1,
      offset: 0,
      limit: 50,
      counts: { waiting: 3, delivered: 5 },
      sales: [{ id: SALE, title: "Modern British" }],
    });
    expect(page.items[0]).toMatchObject({
      lotId: LOT,
      status: "waiting",
      statusSince: "2026-11-14T10:12:00.000Z",
      destination: "12 Rue Exemple, 69002 Lyon, France",
      quote: { amountMinor: null, requestedAt: "2026-11-14T10:12:00.000Z" },
      lot: { hammerMinor: 125_000, lotNumber: 42 },
      sale: { endsAt: "2026-11-12T18:00:00.000Z" },
      buyer: { paddleNumber: 118 },
      history: [{ kind: "requested", by: "buyer", at: "2026-11-14T10:12:00.000Z" }],
    });
  });

  it("gives the sidebar the number of buyers waiting for a price, over every sale", async () => {
    const fake = reader();
    expect(await new AdminDeliveriesService(fake).summary()).toEqual({ waitingCount: 3 });
    expect(fake.counts).toHaveBeenCalledWith({});
  });

  it("reads one lot's delivery, or null", async () => {
    const fake = reader();
    const service = new AdminDeliveriesService(fake);
    expect((await service.detail(LOT))?.lotId).toBe(LOT);
    fake.findByLotId.mockResolvedValue(null);
    expect(await service.detail(LOT)).toBeNull();
  });

  it("turns a priced quote into pence", async () => {
    const fake = reader([
      record({
        status: "quoted",
        quote: {
          ...record().quote,
          status: "quoted",
          amount: "180.50",
          quotedAt: at("2026-11-15T09:00:00Z"),
        },
      }),
    ]);
    const page = await new AdminDeliveriesService(fake).list({
      view: "quoted",
      sort: "newest",
      limit: 50,
      offset: 0,
    });
    expect(page.items[0]?.quote.amountMinor).toBe(18_050);
  });
});

describe("deliveryHistory", () => {
  it("tells the story from the quote's and the fulfilment's stamps, oldest first", () => {
    const history = deliveryHistory(
      record({
        status: "delivered",
        quote: {
          ...record().quote,
          status: "accepted",
          amount: "180.00",
          quotedAt: at("2026-11-15T09:00:00Z"),
          decidedAt: at("2026-11-15T12:30:00Z"),
        },
        fulfilment: {
          status: "delivered",
          method: "shipping",
          carrier: "Example Couriers",
          trackingNumber: "EX123456789GB",
          paidAt: at("2026-11-15T13:00:00Z"),
          updatedAt: at("2026-11-18T15:00:00Z"),
        },
      }),
    );
    expect(history.map((event) => [event.kind, event.by])).toEqual([
      ["requested", "buyer"],
      ["quoted", "staff"],
      ["accepted", "buyer"],
      ["delivered", "staff"],
    ]);
  });

  it("ends a withdrawn request with the withdrawal, whatever the lot did next", () => {
    const history = deliveryHistory(
      record({
        status: "closed",
        closedReason: "withdrawn",
        quote: { ...record().quote, status: "withdrawn", decidedAt: at("2026-11-15T08:00:00Z") },
        fulfilment: {
          status: "delivered",
          method: "collection",
          carrier: null,
          trackingNumber: null,
          paidAt: null,
          updatedAt: at("2026-11-20T10:00:00Z"),
        },
      }),
    );
    expect(history.map((event) => event.kind)).toEqual(["requested", "withdrawn"]);
  });
});
