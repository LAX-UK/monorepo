/** Originals priced on application may accept authenticated enquiry interest. */
export function isArtworkEligibleForEnquiry(input: {
  eligibleForEditionAllocation: boolean;
  saleState: "for_sale" | "price_on_application" | "sold";
}): boolean {
  return !input.eligibleForEditionAllocation && input.saleState === "price_on_application";
}
