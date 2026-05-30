import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { Lot, PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  buildPortfolioAnalytics,
  filterPortfolioRows,
  filterPortfolioRowsByTitle,
  toPortfolioLotCards,
} from "./dashboard-portfolio.vm";

const checkout = (
  hammerMajor: string,
  premiumMajor: string,
  totalMajor: string,
  kind: "flat" | "tiered" = "flat",
) => ({
  hammerMajor,
  premiumMajor,
  totalMajor,
  policyId: kind === "tiered" ? "tiered:s1" : "flat:lot",
  kind,
});

function makeRow(partial: {
  id?: string;
  title?: string;
  endYear?: number;
  payment?: PortfolioRow["payment"];
  checkout?: ReturnType<typeof checkout> | null;
  artistId?: string | null;
  categoryId?: string | null;
}): PortfolioRow {
  const y = partial.endYear ?? 2023;
  const lot = {
    id: partial.id ?? "lot-1",
    title: partial.title ?? "Work",
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    checkoutPricing:
      partial.checkout === null ? undefined : (partial.checkout ?? checkout("100", "25", "125")),
    categoryId: partial.categoryId ?? "c1",
    categoryIds: partial.categoryId ? [partial.categoryId] : ["c1"],
    endTime: new Date(Date.UTC(y, 5, 10)),
    images: [],
    artistId: partial.artistId ?? null,
    medium: null,
    dimensions: null,
    marketingDetails: null,
  } as unknown as Lot;
  return { lot, payment: partial.payment ?? null };
}

describe("filterPortfolioRowsByTitle", () => {
  it("filters by title substring", () => {
    const rows = [makeRow({ title: "Alpha" }), makeRow({ id: "2", title: "Beta" })];
    expect(filterPortfolioRowsByTitle(rows, "alp")).toHaveLength(1);
    expect(filterPortfolioRowsByTitle(rows, "alp")[0]?.lot.title).toBe("Alpha");
  });
});

describe("filterPortfolioRows", () => {
  it("filters by payment state and year", () => {
    const rows = [
      makeRow({
        id: "a",
        title: "One",
        endYear: 2022,
        payment: { id: "p1", status: "captured" },
      }),
      makeRow({
        id: "b",
        title: "Two",
        endYear: 2023,
        payment: { id: "p2", status: "pending" },
      }),
    ];
    const due = filterPortfolioRows(rows, { qLower: "", payment: "due", year: null });
    expect(due).toHaveLength(1);
    expect(due[0]?.lot.id).toBe("b");

    const y2023 = filterPortfolioRows(rows, { qLower: "", payment: "all", year: 2023 });
    expect(y2023).toHaveLength(1);
    expect(y2023[0]?.lot.id).toBe("b");
  });
});

describe("buildPortfolioAnalytics", () => {
  it("sums totals from checkoutPricing", () => {
    const rows = [
      makeRow({
        id: "1",
        checkout: checkout("200", "50", "250"),
        payment: { id: "p1", status: "captured" },
      }),
      makeRow({
        id: "2",
        checkout: checkout("100", "0", "100"),
        payment: { id: "p2", status: "pending" },
      }),
    ];
    const a = buildPortfolioAnalytics(rows);
    expect(a.totalRows).toBe(2);
    expect(a.totalSpentFormatted).toContain("350");
    expect(a.outstandingFormatted).toContain("100");
  });

  it("reflects filtered subset when analytics run on filtered rows", () => {
    const rows = [
      makeRow({
        id: "1",
        endYear: 2023,
        checkout: checkout("200", "50", "250"),
        payment: { id: "p1", status: "captured" },
      }),
      makeRow({
        id: "2",
        endYear: 2024,
        checkout: checkout("100", "0", "100"),
        payment: { id: "p2", status: "pending" },
      }),
    ];
    const filtered = filterPortfolioRows(rows, { qLower: "", payment: "all", year: 2024 });
    const full = buildPortfolioAnalytics(rows);
    const scoped = buildPortfolioAnalytics(filtered);

    expect(full.totalRows).toBe(2);
    expect(scoped.totalRows).toBe(1);
    expect(scoped.totalSpentFormatted).toContain("100");
    expect(scoped.outstandingFormatted).toContain("100");
    expect(scoped.wonThisYear).toBeLessThanOrEqual(full.wonThisYear);
  });
});

describe("toPortfolioLotCards", () => {
  it("maps artist and checkout labels", () => {
    const rows = [
      makeRow({
        id: "lot-x",
        title: "Blue",
        checkout: checkout("1000", "100", "1100"),
        artistId: "art-1",
        payment: null,
      }),
    ];
    const cards = toPortfolioLotCards(rows, { artistNameById: { "art-1": "Jane Doe" } });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.artistName).toBe("Jane Doe");
    expect(cards[0]?.checkoutHref).toBe(dashboardCheckoutLotUrl("lot-x"));
    expect(cards[0]?.premiumLabel).toMatch(/100/);
    expect(cards[0]?.totalLabel).toMatch(/1,100/);
  });

  it("handles missing checkoutPricing", () => {
    const rows = [makeRow({ id: "n", checkout: null })];
    const cards = toPortfolioLotCards(rows);
    expect(cards[0]?.totalLabel).toBe("—");
  });
});
