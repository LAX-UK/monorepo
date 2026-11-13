import { describe, expect, it, vi } from "vitest";
import { SoldAndPayoutsService } from "./sold-and-payouts.service.js";

/**
 * Nothing a seller reads may name or identify the buyer: LAX pays the seller itself, so the
 * buyer's identity is not needed to complete the sale. Even if a reader row ever carried the
 * buyer (a join added later, a column spread in), Sold & payouts, its CSV and the payout's lines
 * must not pass it on.
 */

const BUYER = {
  buyerId: "b0000000-0000-4000-8000-0000000000b1",
  buyerName: "A. Collector",
  buyerEmail: "a.collector@example.com",
  buyerLegalEntityId: "b0000000-0000-4000-8000-0000000000e1",
  winnerId: "b0000000-0000-4000-8000-0000000000b2",
  paddleNumber: "P-417",
  buyerLocation: "Bath, United Kingdom",
};
const BUYER_KEY = /buyer(?!sPremium)|winner|paddle|bidder/i;

const actor = {
  userId: "owner-1",
  legalEntityId: "11111111-1111-4111-8111-111111111111",
  role: "owner" as const,
};

const sold = (soldAfterAuction: boolean) => ({
  ...BUYER,
  lotId: soldAfterAuction ? "l2" : "l1",
  lotTitle: "Harbour at Dusk",
  lotNumber: 31,
  saleTitle: "Autumn",
  soldAt: new Date("2026-10-01T18:00:00Z"),
  hammerPrice: "82000.00",
  soldAfterAuction,
  payment: {
    ...BUYER,
    status: "captured" as const,
    amount: "82000.00",
    platformFee: "14760.00",
    sellerSide: { ...BUYER, amount: "82000.00", platformFee: "14760.00" },
    sellerTerms: null,
  },
  payout: {
    ...BUYER,
    id: "po1",
    status: "paid" as const,
    settledAt: new Date("2026-10-20T00:00:00Z"),
    lineAmount: "67240.00",
  },
});

const payout = {
  ...BUYER,
  id: "po1",
  status: "paid" as const,
  currency: "GBP",
  grossAmount: "82000.00",
  platformFee: "14760.00",
  stripeFee: "0.00",
  netAmount: "67240.00",
  periodStart: new Date("2026-10-01T00:00:00Z"),
  periodEnd: new Date("2026-10-20T00:00:00Z"),
  processedAt: new Date("2026-10-20T00:00:00Z"),
  lines: [false, true].map((soldAfterAuction, index) => ({
    ...BUYER,
    id: `line${index}`,
    kind: "sale",
    amount: "33620.00",
    note: null,
    lot: {
      ...BUYER,
      id: `l${index}`,
      title: "Harbour at Dusk",
      lotNumber: 31,
      hammerPrice: "41000.00",
    },
    payment: { ...BUYER, amount: "41000.00", platformFee: "7380.00" },
    sellerTerms: null,
    soldAfterAuction,
  })),
};

function service() {
  return new SoldAndPayoutsService({
    sold: { list: vi.fn(async () => [sold(false), sold(true)]) } as never,
    payouts: { find: vi.fn(async () => payout) } as never,
  });
}

/** Every key, at any depth, of what the seller is sent. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
  }
  return [];
}

function expectNoBuyer(sent: unknown) {
  expect(keysOf(sent).filter((key) => BUYER_KEY.test(key))).toEqual([]);
  const text = typeof sent === "string" ? sent : JSON.stringify(sent);
  expect(Object.values(BUYER).filter((value) => text.includes(value))).toEqual([]);
}

describe("seller endpoints never return the buyer", () => {
  it("GET /legal-entities/sold: no buyer field or value on any sold lot", async () => {
    const page = (await service().listSold(actor, { limit: 10, offset: 0 }))._unsafeUnwrap();
    expect(page.items).toHaveLength(2);
    expectNoBuyer(page);
  });

  it("GET /legal-entities/payouts/:id/lines: no buyer field or value on the payout or its lines", async () => {
    const detail = (await service().payoutDetail(actor, "po1"))._unsafeUnwrap();
    expect(detail.lines).toHaveLength(2);
    expectNoBuyer(detail);
  });

  it("GET /legal-entities/sold/export.csv: no buyer column or value, and says how each lot sold", async () => {
    const csv = (await service().exportSoldCsv(actor, {}))._unsafeUnwrap();
    const [header, ...rows] = csv.trim().split("\n");
    expect(header?.split(",").filter((column) => BUYER_KEY.test(column))).toEqual([]);
    expectNoBuyer(csv);
    expect(rows[0]).toContain("Sold at auction");
    expect(rows[1]).toContain("Sold after the auction to the next bidder");
  });
});
