import { describe, expect, it } from "vitest";
import type { CommissionVatTreatment } from "./seller-proceeds.js";
import { type AgreementFacts, SellerTermsPolicy } from "./seller-terms.js";

const SELLER = "seller-1";
const request = {
  lotId: "lot-1",
  sellerLegalEntityId: SELLER,
  hammerPence: 8_200_000,
  premiumPence: 2_050_000,
};
const signed: AgreementFacts = {
  id: "agreement-1",
  legalEntityId: SELLER,
  acceptedAt: new Date("2026-10-01T10:00:00Z"),
  commissionPercent: "15.00",
};

function policy(
  options: {
    laxOwned?: boolean;
    agreement?: AgreementFacts | null;
    vat?: CommissionVatTreatment | null;
  } = {},
) {
  const calls = { agreement: 0, vat: 0 };
  const instance = new SellerTermsPolicy(
    {
      isLaxOwned: async () => options.laxOwned ?? false,
      agreementForLot: async () => {
        calls.agreement++;
        return options.agreement === undefined ? signed : options.agreement;
      },
    },
    {
      read: async () => {
        calls.vat++;
        return options.vat === undefined ? "standard" : options.vat;
      },
    },
  );
  return { instance, calls };
}

describe("SellerTermsPolicy", () => {
  it("snapshots the owner's example from the signed agreement", async () => {
    const { instance } = policy();
    expect(await instance.snapshotFor(request)).toEqual({
      ...request,
      basis: "agreement",
      agreementId: "agreement-1",
      commissionBps: 1500,
      commissionPence: 1_230_000,
      commissionVatTreatment: "standard",
      commissionVatBps: 2000,
      commissionVatPence: 246_000,
      otherCharges: [],
      sellerNetPence: 6_724_000,
      ruleVersion: "agreement_hammer_v1",
    });
  });

  it("keeps the buyer's premium out of the seller's figures", async () => {
    const { instance } = policy();
    const withPremium = await instance.snapshotFor(request);
    const without = await instance.snapshotFor({ ...request, premiumPence: 0 });
    expect(withPremium).toMatchObject({ sellerNetPence: 6_724_000 });
    expect(without).toMatchObject({ sellerNetPence: 6_724_000 });
  });

  it("LAX-owned stock needs no agreement and no VAT setting", async () => {
    const { instance, calls } = policy({ laxOwned: true, agreement: null, vat: null });
    expect(await instance.snapshotFor(request)).toEqual({
      ...request,
      basis: "lax_owned",
      ruleVersion: "agreement_hammer_v1",
    });
    expect(calls).toEqual({ agreement: 0, vat: 0 });
  });

  it.each([
    ["there is no agreement", { agreement: null }, "no_agreement"],
    [
      "it is for another seller",
      { agreement: { ...signed, legalEntityId: "other" } },
      "other_seller",
    ],
    [
      "the seller has not accepted it",
      { agreement: { ...signed, acceptedAt: null } },
      "not_accepted",
    ],
    [
      "it has no commission",
      { agreement: { ...signed, commissionPercent: null } },
      "no_commission",
    ],
    [
      "its commission is not a rate",
      { agreement: { ...signed, commissionPercent: "150.00" } },
      "no_commission",
    ],
    ["the VAT setting is missing", { vat: null }, "vat_setting_missing"],
  ] as const)("holds the sale when %s", async (_name, options, reason) => {
    const { instance } = policy(options);
    expect(await instance.snapshotFor(request)).toMatchObject({
      basis: "held",
      heldReason: reason,
      hammerPence: request.hammerPence,
    });
  });

  it("holds a sale whose deductions pass the hammer", async () => {
    const { instance } = policy({ agreement: { ...signed, commissionPercent: "100.00" } });
    expect(await instance.snapshotFor(request)).toMatchObject({
      basis: "held",
      heldReason: "negative_net",
    });
  });

  it("never falls back to a default rate for another seller's agreement", async () => {
    const { instance } = policy({ agreement: { ...signed, legalEntityId: "other" } });
    const got = await instance.snapshotFor(request);
    expect(got).not.toHaveProperty("commissionBps");
    expect(got).not.toHaveProperty("sellerNetPence");
  });

  it("treats a zero commission agreement as valid", async () => {
    const { instance } = policy({ agreement: { ...signed, commissionPercent: "0.00" } });
    expect(await instance.snapshotFor(request)).toMatchObject({
      basis: "agreement",
      commissionPence: 0,
      sellerNetPence: request.hammerPence,
    });
  });
});
