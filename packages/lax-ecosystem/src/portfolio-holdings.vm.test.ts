import { describe, expect, it } from "vitest";
import { ART_BUSINESS, item } from "./portfolio-fixtures.test-util.js";
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
