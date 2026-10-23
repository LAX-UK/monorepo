import { LaxMoneyEntryV1, LaxPortfolioItemV1 } from "@auction/lax-ecosystem";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  edition,
  facts,
  order,
  original,
  pendingLine,
  refund,
  sale,
  work,
} from "../../test-support/portfolio-facts.js";
import {
  type ShopPortfolioContext,
  buildShopMoneyEntries,
  buildShopPortfolioItems,
} from "./shop-portfolio.adapter.js";

const ctx: ShopPortfolioContext = {
  shopOrigin: "https://shop.lax.art",
  artOrigin: "https://lax.art",
  legalName: "LAX Art Ltd",
  imageUrl: (key) => (key ? `https://cdn.lax.art/${key}` : null),
};

const NOW = new Date("2026-08-01T00:00:00.000Z");

function itemsFor(overrides: Parameters<typeof facts>[0]) {
  const items = buildShopPortfolioItems(facts(overrides), ctx);
  for (const item of items) expect(Value.Check(LaxPortfolioItemV1, item)).toBe(true);
  return items;
}

function entriesFor(overrides: Parameters<typeof facts>[0]) {
  const entries = buildShopMoneyEntries(facts(overrides), ctx, NOW);
  for (const entry of entries) expect(Value.Check(LaxMoneyEntryV1, entry)).toBe(true);
  return entries;
}

const purchase = (patch: Partial<NonNullable<ReturnType<typeof edition>["purchase"]>>) => {
  const base = edition().purchase;
  if (!base) throw new Error("fixture has a purchase");
  return { ...base, ...patch };
};

describe("buildShopPortfolioItems: editions", () => {
  it("presents a delivered edition as owned with price and shipping lines", () => {
    const [item] = itemsFor({ editions: [edition()] });
    expect(item).toMatchObject({
      product: "shop",
      title: "Quiet Orchard",
      artist: "Ines Okafor",
      image: "https://cdn.lax.art/artworks/quiet-orchard.jpg",
      acquiredAt: "2026-05-02T12:00:00.000Z",
      status: "owned",
      business: { key: "lax_art", legalName: "LAX Art Ltd" },
    });
    expect(item?.paid.lines).toEqual([
      { kind: "price", amount: 45_000, currency: "GBP" },
      { kind: "shipping", amount: 2_500, currency: "GBP" },
    ]);
    expect(item?.actions).toEqual([
      { kind: "resell", href: "https://shop.lax.art/account/sale-limits" },
      { kind: "view", href: "https://shop.lax.art/artworks/quiet-orchard" },
    ]);
  });

  it.each([
    "pending_production",
    "in_production",
    "awaiting_dispatch",
    "in_transit",
    "ready_for_collection",
  ])("treats fulfilment %s as awaiting shipment, with a tracking link", (fulfilmentStatus) => {
    const [item] = itemsFor({ editions: [edition({ purchase: purchase({ fulfilmentStatus }) })] });
    expect(item?.status).toBe("awaiting_shipment");
    expect(item?.actions[0]).toEqual({
      kind: "track_shipping",
      href: "https://shop.lax.art/account/orders/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
  });

  it.each(["delivered", "collected", "in_storage", "cancelled", null])(
    "treats fulfilment %s as owned",
    (fulfilmentStatus) => {
      const [item] = itemsFor({
        editions: [edition({ purchase: purchase({ fulfilmentStatus }) })],
      });
      expect(item?.status).toBe("owned");
    },
  );

  it("shows an edition the owner has offered for sale as in_sale and keeps what was paid", () => {
    const [item] = itemsFor({ editions: [edition({ listingStatus: "authorised" })] });
    expect(item?.status).toBe("in_sale");
    expect(item?.paid.lines).toHaveLength(2);
    expect(item?.actions.map((a) => a.kind)).toEqual(["view"]);
  });

  it("lists a granted edition as owned with no cost, dated by the edition record", () => {
    const [item] = itemsFor({ editions: [edition({ purchase: null })] });
    expect(item?.status).toBe("owned");
    expect(item?.paid.lines).toEqual([]);
    expect(item?.acquiredAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it.each(["refunded", "pending_payment", "cancelled"])(
    "leaves an edition whose order is %s out of the holdings",
    (orderStatus) => {
      expect(itemsFor({ editions: [edition({ purchase: purchase({ orderStatus }) })] })).toEqual(
        [],
      );
    },
  );

  it("keeps a partially refunded order's edition", () => {
    const [item] = itemsFor({
      editions: [edition({ purchase: purchase({ orderStatus: "partially_refunded" }) })],
    });
    expect(item?.status).toBe("owned");
  });

  it("uses the order's channel for the product and links to lax.art without a resell action", () => {
    const [item] = itemsFor({
      editions: [
        edition({ purchase: purchase({ channel: "art" }), work: work({ channel: "art" }) }),
      ],
    });
    expect(item?.product).toBe("art");
    expect(item?.actions).toEqual([
      { kind: "view", href: "https://lax.art/artworks/quiet-orchard" },
    ]);
  });

  it.each([
    [
      "issued",
      [{ kind: "certificate", available: true, href: "https://shop.lax.art/account/documents" }],
    ],
    [
      "expected",
      [
        {
          kind: "certificate",
          available: false,
          expectedNote: "Your certificate appears here once it has been issued.",
        },
      ],
    ],
    ["none", []],
  ] as const)("reports a %s certificate", (certificate, documents) => {
    const [item] = itemsFor({ editions: [edition({ certificate })] });
    expect(item?.documents).toEqual(documents);
  });
});

describe("buildShopPortfolioItems: originals, pending orders and sales", () => {
  it.each([
    ["deposit_due", "awaiting_payment"],
    ["invoiced", "awaiting_payment"],
    ["paid", "awaiting_shipment"],
    ["assigned", "owned"],
  ] as const)("maps an original sale %s to %s", (status, expected) => {
    const [item] = itemsFor({ originals: [original({ status })] });
    expect(item).toMatchObject({ product: "art", status: expected });
    expect(item?.paid.lines).toEqual([{ kind: "price", amount: 1_200_000, currency: "GBP" }]);
  });

  it("offers payment of an unpaid original through the lax.art collection", () => {
    const [item] = itemsFor({ originals: [original({ status: "invoiced" })] });
    expect(item?.actions[0]).toEqual({ kind: "pay", href: "https://lax.art/account/collection" });
  });

  it("lists an order awaiting payment with a pay action to the order", () => {
    const [item] = itemsFor({ pendingOrderLines: [pendingLine({ shippingPence: 2_500 })] });
    expect(item).toMatchObject({ status: "awaiting_payment", product: "shop" });
    expect(item?.paid.lines.map((l) => l.kind)).toEqual(["price", "shipping"]);
    expect(item?.actions[0]).toEqual({
      kind: "pay",
      href: "https://shop.lax.art/account/orders/ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
  });

  it.each([
    ["paid", "payout_paid"],
    ["due", "payout_pending"],
    ["pending_refund_period", "payout_pending"],
  ] as const)("maps a %s payout to %s", (status, expected) => {
    expect(itemsFor({ sales: [sale({ status })] })[0]?.status).toBe(expected);
  });

  it("leaves out a cancelled payout and one that cannot be traced to an artwork", () => {
    expect(itemsFor({ sales: [sale({ status: "cancelled" }), sale({ work: null })] })).toEqual([]);
  });
});

describe("buildShopMoneyEntries", () => {
  it("reports a paid order as paid, dated by payment", () => {
    expect(entriesFor({ orders: [order()] })).toEqual([
      expect.objectContaining({
        id: "order:cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        direction: "paid",
        status: "completed",
        amount: 47_500,
        currency: "GBP",
        occurredAt: "2026-05-02T12:00:00.000Z",
        href: "https://shop.lax.art/account/orders/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        business: { key: "lax_art", legalName: "LAX Art Ltd" },
      }),
    ]);
  });

  it.each(["partially_refunded", "refunded"])("still reports a %s order as paid", (status) => {
    expect(entriesFor({ orders: [order({ status })] })[0]?.direction).toBe("paid");
  });

  it("reports a live checkout as owed, but not an expired or abandoned one", () => {
    const live = order({
      status: "pending_payment",
      paidAt: null,
      checkoutExpiresAt: new Date("2026-08-01T01:00:00.000Z"),
    });
    const expired = order({
      orderId: "11111111-1111-4111-8111-111111111111",
      status: "pending_payment",
      paidAt: null,
      checkoutExpiresAt: new Date("2026-07-31T23:00:00.000Z"),
    });
    const abandoned = order({
      orderId: "22222222-2222-4222-8222-222222222222",
      status: "expired",
      paidAt: null,
    });
    const entries = entriesFor({ orders: [live, expired, abandoned] });
    expect(entries.map((e) => [e.direction, e.status])).toEqual([["owed_by_you", "pending"]]);
  });

  it.each([
    ["succeeded", "completed"],
    ["pending", "pending"],
    ["cancelled", "cancelled"],
  ] as const)("reports a %s refund as %s", (status, expected) => {
    expect(entriesFor({ refunds: [refund({ status })] })[0]).toMatchObject({
      direction: "refunded",
      status: expected,
      amount: 47_500,
    });
  });

  it("ignores a failed refund because no money moved", () => {
    expect(entriesFor({ refunds: [refund({ status: "failed" })] })).toEqual([]);
  });

  it("reports an original sale as owed until it is paid", () => {
    const entries = entriesFor({
      originals: [
        original({ status: "invoiced" }),
        original({ originalSaleId: "33333333-3333-4333-8333-333333333333", status: "assigned" }),
      ],
    });
    expect(entries.map((e) => [e.direction, e.status])).toEqual([
      ["owed_by_you", "pending"],
      ["paid", "completed"],
    ]);
    expect(entries[0]?.href).toBe("https://lax.art/account/collection");
  });

  it("reports a payout as owed to you with the deductions as a fee", () => {
    const entries = entriesFor({ sales: [sale()] });
    expect(entries.map((e) => [e.direction, e.status, e.amount])).toEqual([
      ["owed_to_you", "completed", 80_000],
      ["fee", "completed", 20_000],
    ]);
    expect(entries[0]?.occurredAt).toBe("2026-04-03T10:00:00.000Z");
    expect(entries[0]?.href).toBe("https://shop.lax.art/account/payouts");
  });

  it("reports a due payout as pending, dated by when it is due, and omits a zero fee", () => {
    const entries = entriesFor({
      sales: [sale({ status: "due", paidAt: null, deductionsPence: 0, netPence: 100_000 })],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      status: "pending",
      occurredAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("is empty when there is nothing to report", () => {
    expect(entriesFor({})).toEqual([]);
  });
});
