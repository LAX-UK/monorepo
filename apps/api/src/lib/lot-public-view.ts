import { normalizeUserRoleOrClient, roleHasCapability, type Lot } from "@auction/types";

/** Hide running high bid for active sealed lots from non-admins (REST + cache consumers). */
export function maskLotForPublicView(lot: Lot, role: string | undefined): Lot {
  const r = normalizeUserRoleOrClient(role);
  if (lot.auctionType === "sealed" && lot.status === "active" && !roleHasCapability(r, "auction.manage")) {
    return { ...lot, currentPrice: lot.startingPrice };
  }
  return lot;
}
