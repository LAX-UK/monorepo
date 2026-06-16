import type { Lot } from "@auction/types";

type SessionLike = { id: string } | null | undefined;

type ActingLike = { id: string } | null | undefined;

/** Mirrors API seller anti-shilling: acting buyer LE vs lot seller LE, plus legacy sellerId. */
export function computeIsOwnLot(
  auction: Pick<Lot, "sellerId" | "sellerLegalEntityId">,
  session: SessionLike,
  acting: ActingLike,
): boolean {
  return (
    Boolean(
      acting?.id && auction.sellerLegalEntityId && acting.id === auction.sellerLegalEntityId,
    ) || Boolean(session?.id && auction.sellerId && session.id === auction.sellerId)
  );
}
