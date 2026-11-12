import {
  type AgreementFacts,
  type CommissionVatTreatment,
  type ISellerTermsFacts,
  SELLER_RULE_VERSION,
  SellerTermsPolicy,
  type SellerTermsSnapshot,
} from "@auction/domain";
import { type ISellerTermsAtRaise, SellerTermsAtRaiseService } from "@auction/finance-runtime";

/** A signed agreement at 15% for the seller, the shape the owner's example uses. */
export const SIGNED_AT_15_PERCENT: AgreementFacts = {
  id: "agreement-1",
  legalEntityId: "seller-acct",
  acceptedAt: new Date("2026-10-01T10:00:00.000Z"),
  commissionPercent: "15.00",
};

/**
 * The real seller-terms rule over fixed facts, for service tests: the lot has the given agreement
 * (none when `null`), the Bid company's VAT setting is as given, and the payment's legacy fee is
 * the figure given.
 */
export function sellerTermsForTests(
  options: {
    agreement?: AgreementFacts | null;
    laxOwned?: boolean;
    vat?: CommissionVatTreatment | null;
    platformFee?: string;
  } = {},
): ISellerTermsAtRaise {
  const facts: ISellerTermsFacts = {
    isLaxOwned: async () => options.laxOwned ?? false,
    agreementForLot: async () =>
      options.agreement === undefined ? SIGNED_AT_15_PERCENT : options.agreement,
  };
  return new SellerTermsAtRaiseService(
    new SellerTermsPolicy(facts, {
      read: async () => (options.vat === undefined ? "standard" : options.vat),
    }),
    { computePlatformFeeFromPence: async () => options.platformFee ?? "0.00" },
  );
}

/** Terms for a test that raises an invoice and is not about the seller's side: held, no figures. */
export function heldSellerTerms(
  lotId: string,
  sellerLegalEntityId = "seller-acct",
): SellerTermsSnapshot {
  return {
    lotId,
    sellerLegalEntityId,
    basis: "held",
    heldReason: "no_agreement",
    hammerPence: 0,
    premiumPence: 0,
    ruleVersion: SELLER_RULE_VERSION,
  };
}
