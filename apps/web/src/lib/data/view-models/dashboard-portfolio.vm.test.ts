import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { Lot, PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  buildPayNow,
  buildPortfolioAnalytics,
  filterPortfolioRows,
  filterPortfolioRowsByTitle,
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
        payment: { id: "p1", status: "captured", manualReviewReason: null },
      }),
      makeRow({
        id: "b",
        title: "Two",
        endYear: 2023,
        payment: { id: "p2", status: "pending", manualReviewReason: null },
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
        payment: { id: "p1", status: "captured", manualReviewReason: null },
      }),
      makeRow({
        id: "2",
        checkout: checkout("100", "0", "100"),
        payment: { id: "p2", status: "pending", manualReviewReason: null },
      }),
    ];
    const a = buildPortfolioAnalytics(rows);
    expect(a.totalRows).toBe(2);
    expect(a.totalSpentFormatted).toContain("350");
    expect(a.outstandingFormatted).toContain("100");
  });
});

describe("buildPayNow", () => {
  const paid = { id: "p", status: "captured" as const, manualReviewReason: null };

  it("is null when everything is paid", () => {
    expect(buildPayNow([makeRow({ id: "a", payment: paid })])).toBeNull();
  });

  it("is null when there is nothing won", () => {
    expect(buildPayNow([])).toBeNull();
  });

  it("links one due lot straight to its checkout", () => {
    const pay = buildPayNow([makeRow({ id: "a" }), makeRow({ id: "b", payment: paid })]);
    expect(pay).toMatchObject({ dueCount: 1, href: dashboardCheckoutLotUrl("a") });
    expect(pay?.outstandingLabel).toMatch(/125/);
  });

  it("links several due lots to one basket", () => {
    const pay = buildPayNow([makeRow({ id: "a" }), makeRow({ id: "b" })]);
    expect(pay?.dueCount).toBe(2);
    expect(pay?.href).toBe("/purchases/checkout?lots=a,b");
  });

  it("has no link while every due lot is in compliance review", () => {
    const pay = buildPayNow([makeRow({ id: "a" })], "aml_hold");
    expect(pay).toMatchObject({ dueCount: 1, href: null });
  });

  it("leaves lots in review out of the basket", () => {
    const held = makeRow({
      id: "held",
      payment: { id: "p2", status: "pending", manualReviewReason: "aml_hold" },
    });
    const pay = buildPayNow([makeRow({ id: "ok" }), held]);
    expect(pay?.href).toBe(dashboardCheckoutLotUrl("ok"));
  });
});
