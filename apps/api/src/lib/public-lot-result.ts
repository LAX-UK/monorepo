import type { IPublicLotResultReader } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";

/**
 * A lot whose result is still open as the public reads it: ended, with no buyer and no price. The
 * winner who did not pay, the offer to the next bidder and the new buyer's invoice stay out of it,
 * so the public learns only that the lot has ended.
 */
export function asResultPending<T extends Lot>(lot: T): T {
  return {
    ...lot,
    winnerId: null,
    buyerLegalEntityId: null,
    currentPrice: lot.startingPrice,
    resultPending: true,
  };
}

/**
 * The ended lots among `lots` whose result is not final, presented as ended with no result. Other
 * lots, and every lot when the reader is not wired, are returned as they are. Staff reads do not
 * call this: they see the real buyer and price.
 */
export async function withPublicLotResults<T extends Lot>(
  reader: IPublicLotResultReader | null | undefined,
  lots: readonly T[],
): Promise<T[]> {
  if (!reader) return [...lots];
  const endedIds = lots.filter((lot) => lot.status === "ended").map((lot) => lot.id);
  if (endedIds.length === 0) return [...lots];
  const pending = await reader.pendingAmong(endedIds);
  if (pending.size === 0) return [...lots];
  return lots.map((lot) => (pending.has(lot.id) ? asResultPending(lot) : lot));
}
