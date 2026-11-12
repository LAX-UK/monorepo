import { saleLineBreakdown } from "@auction/domain";
import { gbpAmountToPence, gbpPenceToMajorString } from "./decimal-money.js";
import type { IPlatformFeePolicy } from "./platform-fee.policy.js";

/** A sale as settlement splits it, in whole pence. */
export type SellerNet = {
  /** What the buyer pays: the invoice total (hammer and buyer's premium). */
  salePence: number;
  /** LAX's commission and fees on it. */
  feesPence: number;
  /** What reaches the seller once the sale settles in full. */
  netPence: number;
};

/**
 * What the seller receives for a sale settled in full, worked out exactly as settlement does: the
 * fee is the seller account's platform fee on the buyer's invoice total (the figure the payment
 * stores when it is raised), and the net is that total less the fee, as {@link saleLineBreakdown}
 * shows it on Sold & payouts. An estimate built from this is the payout, for the same total.
 */
export async function sellerNetForSale(
  feePolicy: Pick<IPlatformFeePolicy, "computePlatformFeeFromPence">,
  sellerLegalEntityId: string,
  salePence: number,
): Promise<SellerNet> {
  const platformFee = await feePolicy.computePlatformFeeFromPence(sellerLegalEntityId, salePence);
  const sale = gbpPenceToMajorString(salePence);
  const split = saleLineBreakdown({ lineAmount: sale, paymentAmount: sale, platformFee });
  return {
    salePence,
    feesPence: gbpAmountToPence(split.commissionAndFees),
    netPence: gbpAmountToPence(split.net),
  };
}
