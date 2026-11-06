import { buildPortfolioHeader } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { PAID_SO_FAR_NOTE, buildCollection } from "./collection.vm";
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
      totalDueNote: null,
      paidSoFar: "£1,000.00",
      paidSoFarNote: PAID_SO_FAR_NOTE,
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

  it("says how many invoices are waiting on identity checks", () => {
    const owed = (id: string, state: "due" | "in_review") =>
      item({
        id,
        status: "awaiting_payment",
        owed: {
          amount: 100_000,
          currency: "GBP",
          state,
          ...(state === "in_review" ? { blocker: "review" as const } : {}),
        },
      });
    const one = [owed("a", "in_review"), owed("b", "due")];
    expect(buildCollection(buildPortfolioHeader(one), 2).totalDueNote).toBe(
      "Includes 1 waiting on identity checks.",
    );
    const two = [owed("a", "in_review"), owed("b", "in_review")];
    expect(buildCollection(buildPortfolioHeader(two), 2).totalDueNote).toBe(
      "Includes 2 waiting on identity checks.",
    );
  });

  it("has no note when nothing is held, or nothing is owed", () => {
    const due = [
      item({
        status: "awaiting_payment",
        owed: { amount: 100_000, currency: "GBP", state: "due" },
      }),
    ];
    expect(buildCollection(buildPortfolioHeader(due), 1).totalDueNote).toBeNull();
    expect(
      buildCollection(buildPortfolioHeader([item({ status: "owned" })]), 1).totalDueNote,
    ).toBeNull();
  });
});
