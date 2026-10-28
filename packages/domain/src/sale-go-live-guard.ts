/**
 * A sale goes live only when every consigned lot's seller can be paid. Sellers are listed once
 * each, with the lots they hold back, so staff know exactly whom to chase.
 */
export type GoLiveLot = {
  id: string;
  title: string;
  sellerLegalEntityId?: string | null | undefined;
};

export type SellerWithoutPayouts = {
  sellerLegalEntityId: string;
  lots: { id: string; title: string }[];
};

/**
 * Sellers in `lots` whose payouts are not set up. `payoutsReady` answers for one seller; lots
 * with no seller (LAX's own stock) never block.
 */
export function sellersWithoutPayouts(
  lots: ReadonlyArray<GoLiveLot>,
  payoutsReady: (sellerLegalEntityId: string) => boolean,
): SellerWithoutPayouts[] {
  const bySeller = new Map<string, SellerWithoutPayouts>();
  for (const lot of lots) {
    const sellerId = lot.sellerLegalEntityId;
    if (!sellerId || payoutsReady(sellerId)) continue;
    const entry = bySeller.get(sellerId) ?? { sellerLegalEntityId: sellerId, lots: [] };
    entry.lots.push({ id: lot.id, title: lot.title });
    bySeller.set(sellerId, entry);
  }
  return [...bySeller.values()];
}

/** The refusal staff read when a sale cannot go live, naming each seller. */
export function goLivePayoutsRefusalMessage(sellerNames: readonly string[]): string {
  if (sellerNames.length === 1) {
    return `${sellerNames[0]} has not set up payouts yet, so the sale can't go live. Ask them to finish payout setup, then publish again.`;
  }
  return `${sellerNames.length} sellers have not set up payouts yet, so the sale can't go live: ${sellerNames.join(", ")}. Ask them to finish payout setup, then publish again.`;
}
