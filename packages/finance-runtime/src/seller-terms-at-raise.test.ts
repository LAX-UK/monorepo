import { type AgreementFacts, SellerTermsPolicy } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import { InvoiceInvariantError } from "./invoice-raiser.js";
import { SellerTermsAtRaiseService, hammerAndPremiumOf } from "./seller-terms-at-raise.js";

const SELLER = "seller-acct";
const lot = { id: "lot-1", sellerLegalEntityId: SELLER };
const signed: AgreementFacts = {
  id: "agreement-1",
  legalEntityId: SELLER,
  acceptedAt: new Date("2026-10-01T10:00:00Z"),
  commissionPercent: "15.00",
};
const priced = {
  lines: [
    { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 8_200_000 },
    {
      kind: "buyers_premium",
      label: "Buyer's premium (25%)",
      ratePercent: "25",
      amountPence: 2_050_000,
    },
  ] as const,
  totalPence: 10_250_000,
};

function service(agreement: AgreementFacts | null = signed) {
  const legacy = vi.fn(async (_seller: string, total: number) => ((total * 0.05) / 100).toFixed(2));
  const instance = new SellerTermsAtRaiseService(
    new SellerTermsPolicy(
      { isLaxOwned: async () => false, agreementForLot: async () => agreement },
      { read: async () => "standard" },
    ),
    { computePlatformFeeFromPence: legacy },
  );
  return { instance, legacy };
}

describe("hammerAndPremiumOf", () => {
  it("reads the hammer and the buyer's premium from the lines", () => {
    expect(hammerAndPremiumOf(priced.lines)).toEqual({
      hammerPence: 8_200_000,
      premiumPence: 2_050_000,
    });
  });

  it("has no premium when the invoice has none", () => {
    expect(hammerAndPremiumOf([{ kind: "hammer", amountPence: 5_000 }])).toEqual({
      hammerPence: 5_000,
      premiumPence: 0,
    });
  });

  it("gives nothing for an invoice with no hammer line, rather than guessing from the total", () => {
    expect(hammerAndPremiumOf([{ kind: "legacy_total", amountPence: 5_000 }])).toBeNull();
  });
});

describe("SellerTermsAtRaiseService", () => {
  it("prices the seller on the invoice's own hammer, and keeps the old fee for the payment", async () => {
    const { instance, legacy } = service();
    const got = await instance.forInvoice({ lot, priced });
    expect(got.sellerTerms).toMatchObject({
      basis: "agreement",
      hammerPence: 8_200_000,
      premiumPence: 2_050_000,
      commissionPence: 1_230_000,
      commissionVatPence: 246_000,
      sellerNetPence: 6_724_000,
    });
    // The payment's platform fee stays what it was: 5% of what the buyer pays.
    expect(got.platformFee).toBe("5125.00");
    expect(legacy).toHaveBeenCalledWith(SELLER, 10_250_000);
  });

  it("holds the sale when there is no agreement, and still gives the payment its fee", async () => {
    const got = await service(null).instance.forInvoice({ lot, priced });
    expect(got.sellerTerms).toMatchObject({ basis: "held", heldReason: "no_agreement" });
    expect(got.platformFee).toBe("5125.00");
  });

  it("holds a legacy invoice with no hammer line, and still gives the payment its fee on the total", async () => {
    const { instance, legacy } = service();
    const got = await instance.forInvoice({
      lot,
      priced: {
        lines: [{ kind: "legacy_total", label: "Total", ratePercent: null, amountPence: 99_900 }],
        totalPence: 99_900,
      },
    });
    expect(got.sellerTerms).toEqual({
      lotId: "lot-1",
      sellerLegalEntityId: SELLER,
      hammerPence: 0,
      premiumPence: 0,
      ruleVersion: "agreement_hammer_v1",
      basis: "held",
      heldReason: "legacy_invoice",
    });
    expect(got.platformFee).toBe("49.95");
    expect(legacy).toHaveBeenCalledWith(SELLER, 99_900);
  });

  it("refuses a lot with no seller account", async () => {
    await expect(
      service().instance.forInvoice({
        lot: { id: "lot-1", sellerLegalEntityId: undefined },
        priced,
      }),
    ).rejects.toBeInstanceOf(InvoiceInvariantError);
  });
});
