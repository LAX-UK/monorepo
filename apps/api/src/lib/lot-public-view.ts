import {
  type Lot,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";

/** Hide running high bid for active sealed lots from non-admins (REST + cache consumers). */
export function maskLotForPublicView(
  lot: Lot,
  role: string | undefined,
  staffRole?: string | null | undefined,
): Lot {
  const r = normalizeUserRoleOrClient(role);
  const staff = normalizeUserStaffRole(staffRole);
  if (
    lot.auctionType === "sealed" &&
    lot.status === "active" &&
    !roleHasCapability(r, "auction.manage", staff)
  ) {
    return { ...lot, currentPrice: lot.startingPrice };
  }
  return lot;
}
