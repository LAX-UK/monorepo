import { SellerTermsPolicy } from "@auction/domain";
import { InvoiceRaiser, SellerTermsAtRaiseService } from "@auction/finance-runtime";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { SIGNED_AT_15_PERCENT } from "../../testing/seller-terms.js";
import { ReofferError } from "./reoffer-errors.js";
import { settlementSellerProceeds } from "./reoffer-seller-proceeds.js";

const SELLER = "seller-acct";
const lot = {
  id: "lot-1",
  saleId: "sale-1",
  winnerId: null,
  buyerLegalEntityId: null,
  sellerLegalEntityId: SELLER,
  currentPrice: "0.00",
  buyerPremiumRate: "0.25",
} as unknown as Lot;
const sale = { id: "sale-1", buyerPremiumTiers: null } as unknown as Sale;

const raiser = new InvoiceRaiser({
  invoices: {
    findLiveByLotAndBuyerAccount: async () => null,
    findByPaymentIds: async () => new Map(),
    raise: async () => {
      throw new Error("nothing is raised here");
    },
  },
  sales: { findById: async () => sale },
});

/** The lot priced as the container prices a re-offer: at the hammer, for the buyer who would pay. */
const pricing = {
  async priceFor({
    buyerLegalEntityId,
    hammerPence,
  }: { buyerLegalEntityId: string; hammerPence: number }) {
    const priced = await raiser.price({
      ...lot,
      buyerLegalEntityId,
      currentPrice: (hammerPence / 100).toFixed(2),
    });
    return { lines: priced.lines, totalPence: priced.totalPence };
  },
};

function policy(
  options: { laxOwned?: boolean; agreement?: typeof SIGNED_AT_15_PERCENT | null } = {},
) {
  return new SellerTermsPolicy(
    {
      isLaxOwned: async () => options.laxOwned ?? false,
      agreementForLot: async () =>
        options.agreement === undefined ? SIGNED_AT_15_PERCENT : options.agreement,
    },
    { read: async () => "standard" },
  );
}

const ask = (terms: SellerTermsPolicy, hammerPence: number) =>
  settlementSellerProceeds({ pricing, terms }).proceedsFor({
    lotId: lot.id,
    sellerLegalEntityId: SELLER,
    buyerLegalEntityId: "le-next",
    hammerPence,
  });

describe("the seller's proceeds on a re-offer", () => {
  it("is the signed agreement's commission on the hammer plus VAT, and the buyer's total as the sale", async () => {
    // £82,000 hammer at 15% plus VAT: the seller receives £67,240. The buyer pays £102,500.
    expect(await ask(policy(), 8_200_000)).toEqual({
      salePence: 10_250_000,
      proceedsPence: 6_724_000,
    });
  });

  it("never counts the buyer's premium as the seller's", async () => {
    const withPremium = await ask(policy(), 8_200_000);
    expect(withPremium.salePence).toBeGreaterThan(8_200_000);
    expect(withPremium.proceedsPence).toBeLessThan(8_200_000);
  });

  it("equals what is stored at raise for the same hammer", async () => {
    const raise = new SellerTermsAtRaiseService(policy(), {
      computePlatformFeeFromPence: async () => "0.00",
    });
    const hammerPence = 8_799_999;
    const priced = await pricing.priceFor({ buyerLegalEntityId: "le-next", hammerPence });
    const { sellerTerms } = await raise.forInvoice({ lot, priced });
    const estimate = await ask(policy(), hammerPence);
    expect(sellerTerms).toMatchObject({
      basis: "agreement",
      sellerNetPence: estimate.proceedsPence,
    });
  });

  it("pays LAX-owned stock nothing out", async () => {
    expect(await ask(policy({ laxOwned: true, agreement: null }), 480_000)).toEqual({
      salePence: 600_000,
      proceedsPence: 0,
    });
  });

  it.each([
    ["no agreement", { agreement: null }],
    [
      "an agreement the seller has not accepted",
      { agreement: { ...SIGNED_AT_15_PERCENT, acceptedAt: null } },
    ],
    [
      "an agreement with no commission",
      { agreement: { ...SIGNED_AT_15_PERCENT, commissionPercent: null } },
    ],
  ])("refuses to show a guessed figure for %s", async (_name, options) => {
    await expect(ask(policy(options), 1_000_000)).rejects.toMatchObject({
      name: "ReofferError",
      code: "seller_terms_unavailable",
    });
    await expect(ask(policy(options), 1_000_000)).rejects.toBeInstanceOf(ReofferError);
  });
});
