import { portfolioMoneyAgreement } from "@auction/lax-ecosystem/testing";
import { describe, expect, it } from "vitest";
import {
  edition,
  facts,
  order,
  original,
  pendingLine,
  refund,
  work,
} from "../../test-support/portfolio-facts.js";
import {
  type ShopPortfolioContext,
  buildShopMoneyEntries,
  buildShopPortfolioItems,
} from "./shop-portfolio.adapter.js";

/**
 * Portfolio and Money are two readings of the same orders: "Total due" must equal "Owed by you"
 * and "Paid so far" must equal what Money reports as paid less refunded.
 */
const ctx: ShopPortfolioContext = {
  shopOrigin: "https://shop.lax.art",
  artOrigin: "https://lax.art",
  legalName: "London Art Exchange Ltd",
  imageUrl: () => null,
};

const NOW = new Date("2026-08-01T00:00:00.000Z");

function agreementFor(overrides: Parameters<typeof facts>[0]) {
  const shop = facts(overrides);
  const rows = portfolioMoneyAgreement(
    buildShopPortfolioItems(shop, ctx),
    buildShopMoneyEntries(shop, ctx, NOW),
  );
  for (const row of rows) {
    expect(row.totalDue).toBe(row.owedByYou);
    expect(row.paidSoFar).toBe(row.moneyNetPaid);
  }
  return rows;
}

const purchase = (patch: Partial<NonNullable<ReturnType<typeof edition>["purchase"]>>) => {
  const base = edition().purchase;
  if (!base) throw new Error("fixture has a purchase");
  return { ...base, ...patch };
};

describe("Shop Portfolio and Money agree on what was paid", () => {
  it("counts the full payment when it exceeds the item price by the delivery charge", () => {
    const harborPrint = edition({
      editionId: "harbor",
      work: work({ title: "Harbor Print" }),
      purchase: purchase({ orderId: "order-harbor", unitPricePence: 8_500, shippingPence: 1_500 }),
    });
    const [row] = agreementFor({
      editions: [harborPrint],
      orders: [order({ orderId: "order-harbor", totalPence: 10_000 })],
    });
    expect(row).toMatchObject({ business: "lax_art", paidSoFar: 10_000, moneyPaid: 10_000 });
  });

  it("agrees when there is no delivery charge", () => {
    const [row] = agreementFor({
      editions: [edition({ purchase: purchase({ unitPricePence: 45_000, shippingPence: 0 }) })],
      orders: [order({ totalPence: 45_000 })],
    });
    expect(row).toMatchObject({ paidSoFar: 45_000, moneyPaid: 45_000 });
  });

  it("takes a partial refund off what was paid on both pages", () => {
    const [row] = agreementFor({
      editions: [edition({ purchase: purchase({ unitPricePence: 45_000, shippingPence: 2_500 }) })],
      orders: [order({ totalPence: 47_500, status: "partially_refunded" })],
      refunds: [refund({ amountPence: 10_000, status: "succeeded" })],
    });
    expect(row).toMatchObject({ paidSoFar: 37_500, moneyPaid: 47_500, moneyRefunded: 10_000 });
  });

  it("spreads a refund across the works of one order", () => {
    const [row] = agreementFor({
      editions: [
        edition({
          editionId: "first",
          purchase: purchase({ unitPricePence: 20_000, shippingPence: 2_000 }),
        }),
        edition({
          editionId: "second",
          purchase: purchase({ unitPricePence: 30_000, shippingPence: 0 }),
        }),
      ],
      orders: [order({ totalPence: 52_000, status: "partially_refunded" })],
      refunds: [refund({ amountPence: 25_000, status: "succeeded" })],
    });
    expect(row).toMatchObject({ paidSoFar: 27_000, moneyNetPaid: 27_000 });
  });

  it("ignores a refund that failed or was cancelled", () => {
    const [row] = agreementFor({
      editions: [edition({ purchase: purchase({ unitPricePence: 45_000, shippingPence: 0 }) })],
      orders: [order({ totalPence: 45_000 })],
      refunds: [
        refund({ refundId: "f", amountPence: 5_000, status: "failed" }),
        refund({ refundId: "c", amountPence: 6_000, status: "cancelled" }),
      ],
    });
    expect(row).toMatchObject({ paidSoFar: 45_000, moneyRefunded: 0 });
  });

  it("states nothing paid for a fully refunded order", () => {
    const [row] = agreementFor({
      editions: [
        edition({
          purchase: purchase({ orderStatus: "refunded", unitPricePence: 45_000, shippingPence: 0 }),
        }),
      ],
      orders: [order({ totalPence: 45_000, status: "refunded" })],
      refunds: [refund({ amountPence: 45_000, status: "succeeded" })],
    });
    expect(row).toMatchObject({ paidSoFar: 0, moneyPaid: 45_000, moneyRefunded: 45_000 });
  });

  it("owes the order total, delivery included, on both pages for an unpaid order", () => {
    const [row] = agreementFor({
      pendingOrderLines: [
        pendingLine({ orderLineId: "l1", unitPricePence: 30_000, shippingPence: 2_500 }),
        pendingLine({ orderLineId: "l2", unitPricePence: 15_000, shippingPence: 0 }),
      ],
      orders: [
        order({
          orderId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          status: "pending_payment",
          totalPence: 47_500,
          paidAt: null,
          checkoutExpiresAt: new Date("2026-08-02T00:00:00.000Z"),
        }),
      ],
    });
    expect(row).toMatchObject({ totalDue: 47_500, owedByYou: 47_500 });
  });

  it("owes an invoiced original on both pages", () => {
    const [row] = agreementFor({
      originals: [original({ status: "invoiced", salePricePence: 1_200_000 })],
    });
    expect(row).toMatchObject({ totalDue: 1_200_000, owedByYou: 1_200_000, paidSoFar: 0 });
  });
});
