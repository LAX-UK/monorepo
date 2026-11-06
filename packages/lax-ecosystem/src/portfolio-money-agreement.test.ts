import { describe, expect, it } from "vitest";
import { ART_BUSINESS, item, moneyEntry } from "./portfolio-fixtures.test-util.js";
import { portfolioMoneyAgreement } from "./portfolio-money-agreement.js";

describe("portfolioMoneyAgreement", () => {
  it("pairs the header and the ledger per business and currency", () => {
    const result = portfolioMoneyAgreement(
      [
        item({ status: "awaiting_payment", owed: { amount: 700, currency: "GBP", state: "due" } }),
        item({ id: "b", paid: { lines: [{ kind: "price", amount: 500, currency: "GBP" }] } }),
        item({
          id: "c",
          business: ART_BUSINESS,
          product: "shop",
          paid: { lines: [{ kind: "price", amount: 900, currency: "EUR" }] },
        }),
      ],
      [
        moneyEntry({ direction: "owed_by_you", status: "pending", amount: 700 }),
        moneyEntry({ id: "p", amount: 500 }),
        moneyEntry({ id: "q", business: ART_BUSINESS, amount: 900, currency: "EUR" }),
      ],
    );
    expect(result).toEqual([
      {
        business: "lax_bid",
        currency: "GBP",
        totalDue: 700,
        owedByYou: 700,
        paidSoFar: 500,
        moneyPaid: 500,
      },
      {
        business: "lax_art",
        currency: "EUR",
        totalDue: 0,
        owedByYou: 0,
        paidSoFar: 900,
        moneyPaid: 900,
      },
    ]);
  });

  it("is empty when there is nothing to compare", () => {
    expect(portfolioMoneyAgreement([], [])).toEqual([]);
  });
});
