import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util.js";
import { buildPortfolioHeader } from "./portfolio-header.vm.js";

describe("buildPortfolioHeader", () => {
  it("returns zeros and no totals for an empty portfolio", () => {
    expect(buildPortfolioHeader([])).toEqual({
      worksOwned: 0,
      inSaleOrConsigned: 0,
      awaitingPayment: 0,
      totalDue: [],
      inReview: 0,
      paidSoFar: [],
    });
  });

  it("counts works by lifecycle group", () => {
    const header = buildPortfolioHeader([
      item({ id: "a", status: "owned" }),
      item({ id: "b", status: "awaiting_shipment" }),
      item({ id: "c", status: "in_sale" }),
      item({ id: "d", status: "consigned" }),
      item({ id: "e", status: "awaiting_payment" }),
      item({ id: "f", status: "sold" }),
    ]);
    expect(header).toMatchObject({ worksOwned: 2, inSaleOrConsigned: 2, awaitingPayment: 1 });
  });

  it("counts a payment being confirmed as neither owed nor paid", () => {
    const header = buildPortfolioHeader([
      item({
        id: "a",
        status: "payment_confirming",
        paid: { lines: [{ kind: "hammer", amount: 1000, currency: "GBP" }] },
      }),
    ]);
    expect(header).toMatchObject({ awaitingPayment: 0, totalDue: [], paidSoFar: [] });
  });

  it("keeps each currency separate and never sums across them", () => {
    const header = buildPortfolioHeader([
      item({
        id: "a",
        paid: {
          lines: [
            { kind: "hammer", amount: 1000, currency: "GBP" },
            { kind: "premium", amount: 250, currency: "GBP" },
          ],
        },
      }),
      item({ id: "b", paid: { lines: [{ kind: "price", amount: 3100, currency: "EUR" }] } }),
    ]);
    expect(header.paidSoFar).toEqual([
      { currency: "EUR", amount: 3100 },
      { currency: "GBP", amount: 1250 },
    ]);
  });

  it("excludes shipping from the cost basis", () => {
    const header = buildPortfolioHeader([
      item({
        paid: {
          lines: [
            { kind: "price", amount: 5000, currency: "GBP" },
            { kind: "shipping", amount: 900, currency: "GBP" },
          ],
        },
      }),
    ]);
    expect(header.paidSoFar).toEqual([{ currency: "GBP", amount: 5000 }]);
  });

  it("does not count an unpaid invoice as paid", () => {
    const header = buildPortfolioHeader([
      item({
        status: "awaiting_payment",
        paid: { lines: [{ kind: "hammer", amount: 9000, currency: "GBP" }] },
      }),
    ]);
    expect(header.paidSoFar).toEqual([]);
    expect(header.awaitingPayment).toBe(1);
  });

  it("tolerates works with no recorded cost lines", () => {
    expect(buildPortfolioHeader([item()]).paidSoFar).toEqual([]);
  });

  it("totals what is due per currency from the owed amount, not from the cost lines", () => {
    const header = buildPortfolioHeader([
      item({
        id: "a",
        status: "awaiting_payment",
        paid: { lines: [{ kind: "hammer", amount: 100_000, currency: "GBP" }] },
        owed: { amount: 115_000, currency: "GBP", state: "due" },
      }),
      item({
        id: "b",
        status: "awaiting_payment",
        owed: { amount: 23_000, currency: "GBP", state: "in_review", blocker: "documents" },
      }),
      item({
        id: "c",
        status: "awaiting_payment",
        owed: { amount: 5_000, currency: "EUR", state: "due" },
      }),
      item({ id: "d", status: "owned", owed: { amount: 9_999, currency: "GBP", state: "due" } }),
    ]);
    expect(header.totalDue).toEqual([
      { currency: "EUR", amount: 5_000 },
      { currency: "GBP", amount: 138_000 },
    ]);
    expect(header.inReview).toBe(1);
    expect(header.awaitingPayment).toBe(3);
  });
});
