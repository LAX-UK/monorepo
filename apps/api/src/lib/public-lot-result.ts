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

/** Who is reading: a person, and the buyer accounts they act for. */
export type LotViewer = {
  userId: string | null;
  accountIds: ReadonlySet<string>;
};

/** Whether the viewer is this lot's buyer, in person or through an account they act for. */
export function isViewersLot(lot: Lot, viewer: LotViewer): boolean {
  if (viewer.userId !== null && lot.winnerId === viewer.userId) return true;
  const account = lot.buyerLegalEntityId;
  return account != null && viewer.accountIds.has(account);
}

/**
 * The lot without its buyer's ids: whether it sold stays (`hasWinner`), who bought it does not.
 * Used on every lot a signed-in reader sees that is not theirs.
 */
export function withoutBuyerIds<T extends Lot>(lot: T): T {
  return {
    ...lot,
    winnerId: null,
    buyerLegalEntityId: null,
    ...(lot.status === "ended" ? { hasWinner: lot.winnerId != null } : {}),
  };
}

/**
 * Lots as a signed-in reader sees them: their own lots as they are, so a buyer sees their price;
 * every other lot with an open result shown as ended, and with no buyer ids.
 */
export async function presentLotsForViewer<T extends Lot>(
  reader: IPublicLotResultReader | null | undefined,
  lots: readonly T[],
  viewer: LotViewer,
): Promise<T[]> {
  const others = lots.filter((lot) => !isViewersLot(lot, viewer));
  if (others.length === 0) return [...lots];
  const presented = new Map(
    (await withPublicLotResults(reader, others)).map((lot) => [lot.id, withoutBuyerIds(lot)]),
  );
  return lots.map((lot) => presented.get(lot.id) ?? lot);
}
