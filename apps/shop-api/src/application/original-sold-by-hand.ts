/** The sale states an artwork row can hold. */
export type ArtworkSaleState = "for_sale" | "price_on_application" | "sold";

/**
 * Staff can also mark an original sold by editing its sale state (artwork create, artwork save,
 * import) instead of going through the sale flow. That must reach the register exactly as a sale
 * does, through `OriginalOfferRegister.recordSold`, so every hand-edit path asks this one rule.
 * `before` is null for a row that did not exist. Saving a row that is already sold records nothing.
 */
export function becameSoldByHand(
  before: ArtworkSaleState | null,
  after: ArtworkSaleState,
): boolean {
  return after === "sold" && before !== "sold";
}
