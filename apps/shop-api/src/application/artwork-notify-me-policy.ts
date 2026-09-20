/** Mirrors storefront purchasability on artwork detail (apps/shop). */
export function isArtworkEligibleForNotifyMeSubscription(input: {
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  editionsAvailable: number;
  saleState: "for_sale" | "price_on_application" | "sold";
}): boolean {
  if (input.saleState === "sold") {
    return false;
  }
  if (!input.eligibleForEditionAllocation) {
    return false;
  }
  const purchasableOnline = input.printPricePence !== null && input.editionsAvailable > 0;
  return !purchasableOnline;
}
