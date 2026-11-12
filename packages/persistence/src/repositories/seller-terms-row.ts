import type { saleSellerTerms } from "@auction/db/schema";
import type { SellerTermsSnapshot } from "@auction/domain";

type NewSellerTermsRow = typeof saleSellerTerms.$inferInsert;

/**
 * The stored shape of a snapshot, one row per basis. Figures a basis does not carry are left
 * unset, which is what the table's shape check requires. `legacyPlatformFeePence` is the payment's
 * old-rule `platform_fee`, kept beside the new figures so old and new can be reconciled per sale.
 */
export function sellerTermsRow(
  paymentId: string,
  terms: SellerTermsSnapshot,
  legacyPlatformFeePence: number | null = null,
): NewSellerTermsRow {
  const common = {
    paymentId,
    legacyPlatformFeePence,
    lotId: terms.lotId,
    sellerLegalEntityId: terms.sellerLegalEntityId,
    basis: terms.basis,
    hammerPence: terms.hammerPence,
    premiumPence: terms.premiumPence,
    ruleVersion: terms.ruleVersion,
    source: "raised",
  } satisfies NewSellerTermsRow;
  switch (terms.basis) {
    case "agreement":
      return {
        ...common,
        agreementId: terms.agreementId,
        commissionBps: terms.commissionBps,
        commissionPence: terms.commissionPence,
        commissionVatTreatment: terms.commissionVatTreatment,
        commissionVatBps: terms.commissionVatBps,
        commissionVatPence: terms.commissionVatPence,
        otherCharges: [...terms.otherCharges],
        sellerNetPence: terms.sellerNetPence,
      };
    case "lax_owned":
      return common;
    case "held":
      return { ...common, heldReason: terms.heldReason };
  }
}
