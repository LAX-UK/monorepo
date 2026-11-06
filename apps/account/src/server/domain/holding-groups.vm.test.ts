import { buildHoldings } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { copyLabel, groupHoldingRows, holdingsCountLine } from "./holding-groups.vm";
import { item } from "./portfolio-fixtures.test-util";

type Overrides = Parameters<typeof item>[0];

const price = (amount: number) => ({
  lines: [{ kind: "price" as const, amount, currency: "GBP" }],
});

const copy = (number: number, overrides: Overrides = {}) =>
  item({
    product: "shop",
    id: `reed-${number}`,
    title: "Reed Study",
    artist: "Flora Powers",
    edition: `No. ${number} of 24 · Hand-signed`,
    paid: price(40_000),
    ...overrides,
  });

const groups = (items: ReturnType<typeof item>[], filter = {}) =>
  groupHoldingRows(buildHoldings(items, filter).rows);

describe("groupHoldingRows", () => {
  it("puts every copy of an artwork in a product into one group", () => {
    const result = groups([copy(1), copy(2), copy(3)]);
    expect(result).toHaveLength(1);
    expect(result[0]?.rows).toHaveLength(3);
  });

  it("keeps different artworks, and the same title in another product, apart", () => {
    const result = groups([
      copy(1),
      copy(2),
      item({ product: "shop", id: "v1", title: "Vessel Study", artist: "Flora Powers" }),
      copy(3, { product: "art", id: "art-1" }),
    ]);
    expect(result.map((group) => group.rows.length)).toEqual([2, 1, 1]);
  });

  it("matches titles and artists ignoring case and spacing", () => {
    const result = groups([copy(1), copy(2, { title: " reed study ", artist: "FLORA POWERS" })]);
    expect(result).toHaveLength(1);
  });

  it("never merges works that have no title", () => {
    expect(groups([item({ id: "a", title: "" }), item({ id: "b", title: "" })])).toHaveLength(2);
  });

  it("lists numbered copies by number, then copies without one", () => {
    const [group] = groups([
      copy(11),
      copy(2),
      item({ product: "shop", id: "plain", title: "Reed Study", artist: "Flora Powers" }),
      copy(7),
    ]);
    expect(group?.rows.map((row) => copyLabel(row.item))).toEqual([
      "No. 2 of 24",
      "No. 7 of 24",
      "No. 11 of 24",
      "Owned",
    ]);
  });

  it("names a copy without a number by its status", () => {
    expect(copyLabel(item({ status: "awaiting_shipment" }))).toBe("Awaiting shipment");
  });

  it("leaves a single copy as a group of one", () => {
    const [group] = groups([copy(1)]);
    expect(group?.rows).toHaveLength(1);
    expect(group?.mixed).toBe(false);
  });

  it("keeps the order in which each artwork first appears", () => {
    const result = groups([
      copy(1, { acquiredAt: "2026-01-01T00:00:00.000Z" }),
      item({ id: "other", title: "Vessel Study", acquiredAt: "2026-02-01T00:00:00.000Z" }),
      copy(2, { acquiredAt: "2026-03-01T00:00:00.000Z" }),
    ]);
    expect(result.map((group) => group.lead.item.title)).toEqual(["Reed Study", "Vessel Study"]);
  });
});

describe("a group's paid figure", () => {
  it("adds up the paid lines of its copies, per currency", () => {
    const [group] = groups([
      copy(1),
      copy(2, {
        paid: {
          lines: [
            { kind: "price", amount: 25_000, currency: "GBP" },
            { kind: "shipping", amount: 1_500, currency: "GBP" },
          ],
        },
      }),
      copy(3, { paid: { lines: [{ kind: "price", amount: 10_000, currency: "EUR" }] } }),
    ]);
    expect(group?.paid).toEqual([
      { currency: "EUR", amount: 10_000 },
      { currency: "GBP", amount: 66_500 },
    ]);
  });

  it("counts nothing for a copy still awaiting payment, and reports it as due", () => {
    const [group] = groups([
      copy(1),
      copy(2, {
        status: "awaiting_payment",
        owed: { amount: 40_000, currency: "GBP", state: "due" },
      }),
    ]);
    expect(group?.paid).toEqual([{ currency: "GBP", amount: 40_000 }]);
    expect(group?.due).toEqual([{ currency: "GBP", amount: 40_000 }]);
  });

  it("adds up documents across the copies", () => {
    const documents = [
      { kind: "certificate" as const, available: true },
      { kind: "provenance" as const, available: false },
    ];
    const [group] = groups([copy(1, { documents }), copy(2, { documents })]);
    expect([group?.documentsAvailable, group?.documentsExpected]).toEqual([2, 2]);
  });
});

describe("a group's status", () => {
  it("is the shared status when every copy has the same one", () => {
    const [group] = groups([copy(1), copy(2)]);
    expect(group).toMatchObject({ status: "owned", mixed: false });
  });

  it("is the most urgent copy's status, marked mixed, when they differ", () => {
    const [group] = groups([
      copy(1),
      copy(2, { status: "awaiting_shipment" }),
      copy(3, { status: "awaiting_payment" }),
    ]);
    expect(group).toMatchObject({ status: "awaiting_payment", mixed: true });
  });

  it("prefers work in progress over settled", () => {
    const [group] = groups([copy(1), copy(2, { status: "in_sale" })]);
    expect(group).toMatchObject({ status: "in_sale", mixed: true });
  });
});

describe("grouping filtered copies", () => {
  const all = [copy(1), copy(2, { status: "in_sale" }), copy(3), item({ id: "z", title: "Other" })];

  it("shows a group when any one copy matches, holding only the matching copies", () => {
    const [group] = groups(all, { statuses: ["in_sale"] });
    expect(group?.rows.map((row) => row.item.id)).toEqual(["reed-2"]);
  });

  it("finds a group by search on its artwork, with every copy", () => {
    const result = groups(all, { search: "reed" });
    expect(result).toHaveLength(1);
    expect(result[0]?.rows).toHaveLength(3);
  });

  it("totals only the matching copies", () => {
    const [group] = groups(all, { statuses: ["owned"], search: "reed" });
    expect(group?.paid).toEqual([{ currency: "GBP", amount: 80_000 }]);
  });
});

describe("holdingsCountLine", () => {
  it("reads works in rows once copies are grouped", () => {
    expect(holdingsCountLine(28, 28, 6)).toBe("28 works in 6 rows");
  });

  it("says only the works when every work is its own row", () => {
    expect(holdingsCountLine(2, 2, 2)).toBe("2 works");
    expect(holdingsCountLine(1, 1, 1)).toBe("1 work");
  });

  it("says how many of the works a filter shows", () => {
    expect(holdingsCountLine(3, 28, 2)).toBe("Showing 3 of 28 works in 2 rows");
  });
});
