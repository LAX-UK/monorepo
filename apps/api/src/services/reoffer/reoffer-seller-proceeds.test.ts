import { saleLineBreakdown } from "@auction/domain";
import { InvoiceRaiser, PaymentTierPolicy, PlatformFeePolicy } from "@auction/finance-runtime";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { computeNewPaymentTerms } from "../payment/create-pending-for-winner.pipeline.js";
import { settlementSellerProceeds } from "./reoffer-seller-proceeds.js";

const SELLER = "le-seller";
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

/** The settlement pieces, real: the invoice pricing and the seller account's platform fee. */
function settlement(platformFeeBps: number | null) {
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
  const legalEntities = {
    findById: async (id: string) =>
      id === SELLER ? { id, platformFeeBps, status: "active" } : null,
  } as unknown as ILegalEntityRepository;
  const feePolicy = new PlatformFeePolicy(legalEntities);
  return { raiser, feePolicy, legalEntities };
}

/** What Sold & payouts shows the seller receiving once the buyer pays at this hammer. */
async function settledNetPence(platformFeeBps: number | null, buyer: string, hammer: number) {
  const { raiser, feePolicy, legalEntities } = settlement(platformFeeBps);
  const won = {
    ...lot,
    winnerId: "user-1",
    buyerLegalEntityId: buyer,
    currentPrice: (hammer / 100).toFixed(2),
  };
  const terms = await computeNewPaymentTerms(
    {
      invoiceRaiser: raiser,
      platformFeePolicy: feePolicy,
      legalEntityRepository: legalEntities,
      paymentTierPolicy: new PaymentTierPolicy({
        minPence: 30,
        cardMaxPence: 1_000_000_000,
        manualReviewMinPence: 1_000_000_000,
        absoluteMaxPence: 1_000_000_000,
      }),
      settlementCompliance: null,
      payments: { findRefundedByLotAndBuyerAccount: async () => null },
    } as never,
    won,
    "user-1",
  );
  const { amount, platformFee } = terms._unsafeUnwrap();
  const split = saleLineBreakdown({ lineAmount: amount, paymentAmount: amount, platformFee });
  return Math.round(Number(split.net) * 100);
}

function estimate(platformFeeBps: number | null) {
  const { raiser, feePolicy } = settlement(platformFeeBps);
  return settlementSellerProceeds({
    feePolicy,
    pricing: {
      // As the container prices a re-offer: the lot at the hammer, for the buyer who would pay it.
      async priceFor({ buyerLegalEntityId, hammerPence }) {
        const priced = await raiser.price({
          ...lot,
          buyerLegalEntityId,
          currentPrice: (hammerPence / 100).toFixed(2),
        });
        return { lines: priced.lines, totalPence: priced.totalPence };
      },
    },
  });
}

describe("the seller's proceeds on a re-offer", () => {
  it.each([
    [null, 8_200_000],
    [500, 8_200_000],
    [1_500, 8_200_000],
    [1_250, 8_799_999],
    [0, 12_345],
  ])(
    "equal what settlement pays at the same hammer (fee %s bps, hammer %s)",
    async (bps, hammer) => {
      const got = await estimate(bps).proceedsFor({
        lotId: lot.id,
        sellerLegalEntityId: SELLER,
        buyerLegalEntityId: "le-next",
        hammerPence: hammer,
      });
      expect(got.proceedsPence).toBe(await settledNetPence(bps, "le-next", hammer));
    },
  );

  it("works from the buyer's total, hammer and premium, as settlement does", async () => {
    const got = await estimate(500).proceedsFor({
      lotId: lot.id,
      sellerLegalEntityId: SELLER,
      buyerLegalEntityId: "le-next",
      hammerPence: 8_200_000,
    });
    // £82,000 + 25% premium = £102,500; 5% of it is £5,125; the seller receives £97,375.
    expect(got).toEqual({ salePence: 10_250_000, proceedsPence: 9_737_500 });
  });
});
