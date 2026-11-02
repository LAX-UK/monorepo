import { hangLot, hangSale } from "@/lib/hang/hang-fixtures";
import { buildResultsBand } from "@/lib/home-sections/results-band";
import type { SaleListRow } from "@/lib/sale-list-row";
import type { SaleResultsSummary } from "@auction/domain";
import { describe, expect, it } from "vitest";

const now = new Date("2026-11-02T12:00:00.000Z");
const sold = (id: string, price: string) =>
  hangLot({ id, status: "ended", winnerId: "u", currentPrice: price, artistId: `a-${id}` });

function row(summary: SaleResultsSummary | null): SaleListRow {
  return {
    sale: hangSale({
      id: "s",
      title: "September Modern British",
      status: "ended",
      endTime: new Date("2026-10-15T20:00:00.000Z"),
    }),
    lots: [],
    lotCount: 24,
    resultsSummary: summary,
  };
}

const final: SaleResultsSummary = {
  state: "final",
  lotCount: 24,
  soldCount: 18,
  currency: "GBP",
  totalWithPremium: "186400.00",
  topLot: { lotId: "top", priceWithPremium: "32500.00" },
  endedAt: "2026-10-15T20:00:00.000Z",
};

const input = (over: Partial<Parameters<typeof buildResultsBand>[0]> = {}) => ({
  row: row(final),
  lots: [sold("a", "1000.00"), sold("b", "2000.00"), sold("c", "900.00"), sold("d", "800.00")],
  saleLots: [sold("top", "26000.00")],
  artistNames: {
    "a-top": "Elise Marlowe",
    "a-a": "Henry Lisle",
    "a-b": "Jonah Feld",
    "a-c": "x",
    "a-d": "y",
  },
  subtitle: "Prices include buyer’s premium",
  now,
  ...over,
});

describe("buildResultsBand", () => {
  it("states the figures of the last sale, with the top lot's artist", () => {
    const band = buildResultsBand(input());
    expect(band?.facts).toEqual({
      saleTitle: "September Modern British",
      endedLabel: "Ended Thu 15 Oct · online",
      sold: { value: "18 of 24", note: "75% of lots" },
      total: { value: "£186,400", note: "with buyer’s premium" },
      topLot: { value: "£32,500", note: "Elise Marlowe" },
    });
    expect(band?.lots).toHaveLength(4);
  });

  it("is hidden while the figures are not final", () => {
    expect(
      buildResultsBand(input({ row: row({ state: "finalising", pendingLotCount: 3 }) })),
    ).toBeNull();
    expect(buildResultsBand(input({ row: row(null) }))).toBeNull();
    expect(buildResultsBand(input({ row: undefined }))).toBeNull();
  });

  it("is hidden when nothing sold, so no bare zero appears", () => {
    expect(buildResultsBand(input({ row: row({ ...final, soldCount: 0 }) }))).toBeNull();
  });

  it("shows the figures alone when fewer than four lots remain to show", () => {
    const band = buildResultsBand(input({ lots: [sold("a", "1000.00"), sold("b", "900.00")] }));
    expect(band?.lots).toEqual([]);
    expect(band?.facts.total.value).toBe("£186,400");
  });

  it("leaves the artist out when the top lot was not read", () => {
    expect(buildResultsBand(input({ saleLots: [] }))?.facts.topLot?.note).toBeNull();
  });
});
