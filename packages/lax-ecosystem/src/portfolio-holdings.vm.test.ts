import { describe, expect, it } from "vitest";
import { ART_BUSINESS, item } from "./portfolio-fixtures.test-util.js";
import { buildPortfolioHeader } from "./portfolio-header.vm.js";
import {
  UNKNOWN_ARTIST_LABEL,
  buildHoldings,
  holdingsFilterOptions,
  portfolioEmptyState,
} from "./portfolio-holdings.vm.js";

const works = [
  item({
    id: "a",
    title: "Blue",
    artist: "Ada Artist",
    acquiredAt: "2025-05-01T00:00:00.000Z",
    paid: { lines: [{ kind: "hammer", amount: 100, currency: "GBP" }] },
    documents: [{ kind: "invoice", available: true, href: "/i/a" }],
  }),
  item({
    id: "b",
    title: "Amber",
    artist: "Ben Brush",
    product: "art",
    business: ART_BUSINESS,
    status: "in_sale",
    acquiredAt: "2026-02-01T00:00:00.000Z",
    paid: { lines: [{ kind: "price", amount: 200, currency: "EUR" }] },
    documents: [
      { kind: "invoice", available: true, href: "/i/b" },
      { kind: "certificate", available: false, expectedNote: "Sent after delivery" },
    ],
  }),
  item({ id: "c", title: "Green", artist: "  ", acquiredAt: "2026-04-01T00:00:00.000Z" }),
];

describe("buildHoldings", () => {
  it("sorts newest acquired first by default", () => {
    expect(buildHoldings(works).rows.map((r) => r.item.id)).toEqual(["c", "b", "a"]);
  });

  it("supports oldest first and title sorting", () => {
    expect(buildHoldings(works, {}, "acquired_asc").rows.map((r) => r.item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(buildHoldings(works, {}, "title_asc").rows.map((r) => r.item.title)).toEqual([
      "Amber",
      "Blue",
      "Green",
    ]);
  });

  it("filters by status, product, artist, year and currency", () => {
    const ids = (filter: Parameters<typeof buildHoldings>[1]) =>
      buildHoldings(works, filter).rows.map((r) => r.item.id);
    expect(ids({ statuses: ["in_sale"] })).toEqual(["b"]);
    expect(ids({ products: ["bid"] })).toEqual(["c", "a"]);
    expect(ids({ artist: "Ada Artist" })).toEqual(["a"]);
    expect(ids({ year: 2026 })).toEqual(["c", "b"]);
    expect(ids({ currency: "EUR" })).toEqual(["b"]);
  });

  it("searches title and artist, ignoring case and surrounding space", () => {
    const ids = (search: string) => buildHoldings(works, { search }).rows.map((r) => r.item.id);
    expect(ids("blue")).toEqual(["a"]);
    expect(ids(" BRUSH ")).toEqual(["b"]);
    expect(ids("zzz")).toEqual([]);
    expect(buildHoldings(works, { search: "zzz" }).noResults).toBe(true);
  });

  it("combines filters", () => {
    expect(buildHoldings(works, { year: 2026, products: ["art"] }).rows).toHaveLength(1);
  });

  it("reports per-currency paid and document counts, tolerating missing lines", () => {
    const rows = buildHoldings(works).rows;
    const b = rows.find((r) => r.item.id === "b");
    const c = rows.find((r) => r.item.id === "c");
    expect(b).toMatchObject({
      paid: [{ currency: "EUR", amount: 200 }],
      documentsAvailable: 1,
      documentsExpected: 1,
    });
    expect(c).toMatchObject({ paid: [], documentsAvailable: 0, documentsExpected: 0 });
  });

  it("adds the rows' paid figures up to the header's paid so far", () => {
    const paidLinesOf = [
      item({
        id: "p1",
        paid: {
          lines: [
            { kind: "price", amount: 5000, currency: "GBP" },
            { kind: "shipping", amount: 900, currency: "GBP" },
          ],
        },
      }),
      item({
        id: "p2",
        status: "awaiting_payment",
        paid: { lines: [{ kind: "price", amount: 7000, currency: "GBP" }] },
      }),
    ];
    const { rows } = buildHoldings(paidLinesOf);
    expect(rows.flatMap((row) => row.paid)).toEqual([{ currency: "GBP", amount: 5900 }]);
    expect(buildPortfolioHeader(paidLinesOf).paidSoFar).toEqual([
      { currency: "GBP", amount: 5900 },
    ]);
  });

  it("takes a refund off the paid figure on the row and in the header, leaving the charges whole", () => {
    const refunded = [
      item({
        id: "r1",
        paid: {
          lines: [
            { kind: "price", amount: 45_000, currency: "GBP" },
            { kind: "shipping", amount: 2_500, currency: "GBP" },
          ],
          refunded: { amount: 10_000, currency: "GBP" },
        },
      }),
    ];
    const [row] = buildHoldings(refunded).rows;
    expect(row?.paid).toEqual([{ currency: "GBP", amount: 37_500 }]);
    expect(row?.item.paid.lines[0]).toEqual({ kind: "price", amount: 45_000, currency: "GBP" });
    expect(buildPortfolioHeader(refunded).paidSoFar).toEqual([{ currency: "GBP", amount: 37_500 }]);
  });

  it("counts allocation by artist and product over the filtered works", () => {
    const { allocation } = buildHoldings(works);
    expect(allocation.byProduct).toEqual([
      { label: "bid", count: 2 },
      { label: "art", count: 1 },
    ]);
    expect(allocation.byArtist).toContainEqual({ label: UNKNOWN_ARTIST_LABEL, count: 1 });
    expect(buildHoldings(works, { products: ["art"] }).allocation.byArtist).toEqual([
      { label: "Ben Brush", count: 1 },
    ]);
  });

  it("distinguishes no results from an empty portfolio", () => {
    expect(buildHoldings(works, { artist: "Nobody" }).noResults).toBe(true);
    expect(buildHoldings([]).noResults).toBe(false);
  });
});

describe("holdingsFilterOptions", () => {
  it("lists distinct artists, years (newest first) and currencies", () => {
    expect(holdingsFilterOptions(works)).toEqual({
      artists: ["Ada Artist", "Ben Brush"],
      years: [2026, 2025],
      currencies: ["EUR", "GBP"],
    });
  });
});

describe("portfolioEmptyState", () => {
  it("welcomes a new collector", () => {
    expect(portfolioEmptyState([])).toBe("new_collector");
  });

  it("leads with payment when every work is unpaid", () => {
    expect(portfolioEmptyState([item({ status: "awaiting_payment" })])).toBe(
      "only_awaiting_payment",
    );
  });

  it("explains missing documents when none are available", () => {
    expect(portfolioEmptyState([item()])).toBe("no_documents");
  });

  it("has nothing to explain once a document exists", () => {
    expect(portfolioEmptyState(works)).toBeNull();
  });
});
