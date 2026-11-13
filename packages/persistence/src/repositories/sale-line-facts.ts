import { saleSellerTerms } from "@auction/db/schema";
import { minorUnitsToMoneyString } from "@auction/domain";

/** The figures a sale line is split with, as read beside it. */
export type SaleLineFactsRow = {
  /** The buyer's payment the line settles, and the old-rule fee stored on it. */
  paymentAmount: string | null;
  paymentPlatformFee: string | null;
  /** The snapshot the line pays, when it pays one (joined on `payout_line.seller_terms_id`). */
  termsHammerPence: number | null;
  termsCommissionPence: number | null;
  termsVatPence: number | null;
};

/** The snapshot columns to select beside a sale line, joined on its `seller_terms_id`. */
export const SALE_LINE_TERMS_COLUMNS = {
  termsHammerPence: saleSellerTerms.hammerPence,
  termsCommissionPence: saleSellerTerms.commissionPence,
  termsVatPence: saleSellerTerms.commissionVatPence,
} as const;

/**
 * What a sale line's split is worked from. A line that pays a snapshot splits its hammer into the
 * commission plus VAT and what the seller receives; a line paid under the old rule keeps the
 * buyer's payment and the fee that was taken from it, so old payouts read as they were paid.
 */
export function saleLinePaymentFacts(
  row: SaleLineFactsRow,
): { amount: string; platformFee: string } | null {
  const { termsHammerPence, termsCommissionPence, termsVatPence } = row;
  if (termsHammerPence !== null && termsCommissionPence !== null && termsVatPence !== null) {
    return {
      amount: minorUnitsToMoneyString(BigInt(termsHammerPence)),
      platformFee: minorUnitsToMoneyString(BigInt(termsCommissionPence + termsVatPence)),
    };
  }
  if (row.paymentAmount !== null && row.paymentPlatformFee !== null) {
    return { amount: String(row.paymentAmount), platformFee: String(row.paymentPlatformFee) };
  }
  return null;
}
