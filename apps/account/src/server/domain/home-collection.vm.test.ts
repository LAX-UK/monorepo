import { buildPortfolioHeader } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { buildCollection } from "./home-collection.vm";
import { item } from "./portfolio-fixtures.test-util";

describe("buildCollection", () => {
  it("reads counts and money from the portfolio summary", () => {
    const items = [
      item({
        id: "a",
        status: "owned",
        paid: { lines: [{ kind: "price", amount: 100_000, currency: "GBP" }] },
      }),
      item({ id: "b", status: "consigned" }),
      item({
        id: "c",
        status: "awaiting_payment",
        owed: { amount: 237_500, currency: "GBP", state: "due" },
      }),
    ];
    expect(buildCollection(buildPortfolioHeader(items), items.length)).toEqual({
      counts: [
        { key: "owned", label: "Works owned", shortLabel: "Owned", value: 1 },
        { key: "in-sale", label: "In sale or consigned", shortLabel: "In sale", value: 1 },
        { key: "to-pay", label: "To pay", shortLabel: "To pay", value: 1 },
      ],
      totalDue: "£2,375.00",
      paidSoFar: "£1,000.00",
    });
  });

  it("hides zero figures", () => {
    const items = [item({ status: "owned" })];
    const collection = buildCollection(buildPortfolioHeader(items), 1);
    expect(collection.counts.map((count) => count.key)).toEqual(["owned"]);
    expect(collection.totalDue).toBeNull();
    expect(collection.paidSoFar).toBeNull();
  });

  it("still shows a count when every work is in a state the three counts skip", () => {
    const items = [item({ status: "sold" })];
    expect(buildCollection(buildPortfolioHeader(items), 1).counts).toEqual([
      { key: "works", label: "Works", shortLabel: "Works", value: 1 },
    ]);
  });
});
