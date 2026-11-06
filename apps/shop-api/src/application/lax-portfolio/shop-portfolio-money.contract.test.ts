import { portfolioMoneyAgreement } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { edition, facts, order, work } from "../../test-support/portfolio-facts.js";
import {
  type ShopPortfolioContext,
  buildShopMoneyEntries,
  buildShopPortfolioItems,
} from "./shop-portfolio.adapter.js";

/** "Paid so far" on Portfolio must equal what Money reports as paid for the same orders. */
const ctx: ShopPortfolioContext = {
  shopOrigin: "https://shop.lax.art",
  artOrigin: "https://lax.art",
  legalName: "London Art Exchange Ltd",
  imageUrl: () => null,
};

const NOW = new Date("2026-08-01T00:00:00.000Z");

function agreementFor(overrides: Parameters<typeof facts>[0]) {
  const shop = facts(overrides);
  return portfolioMoneyAgreement(
    buildShopPortfolioItems(shop, ctx),
    buildShopMoneyEntries(shop, ctx, NOW),
  );
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
});
