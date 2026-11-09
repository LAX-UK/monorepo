import { type EnquiryDealRecord, isDealRecordRetained } from "../marketing-enquiry-erasure.js";

/**
 * Whether the KYC, AML and source-of-funds evidence of someone who is, or was ever named as, a
 * party to private sale deals must be kept because a deal's record is still retained.
 *
 * The evidence for a person's own five years after their relationship ends (the KYC retention) and
 * the evidence for a deal's record for the private sale retention after the deal ends (the
 * Money Laundering Regulations 2017, regulation 40: five years after the transaction) are two
 * clocks. The evidence is deleted only when both have run out, so this rule is the second one: it
 * holds the evidence while any deal the person was named on is still retained, by the same rule
 * that holds the deal's enquiry from erasure. A deal still open, a deal with no known end, and a
 * deal that ended inside the period all hold it; a deal withdrawn before agreement with no check
 * opened for the person since the enquiry arrived holds nothing.
 */
export function kycEvidenceHeldForDeals(
  deals: readonly EnquiryDealRecord[],
  now: Date,
  retentionYears: number,
): boolean {
  return deals.some((deal) => isDealRecordRetained(deal, now, retentionYears));
}
