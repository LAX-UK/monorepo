import { deriveReserveStatus, hasConfiguredReserve } from "@auction/domain";
import {
  type Lot,
  type PublicLotView,
  type StaffRoles,
  normalizeUserRoleOrClient,
  roleHasCapability,
} from "@auction/types";

function viewerCanSeeStaffLotPricing(
  role: string | undefined,
  staffRoles?: StaffRoles | undefined,
): boolean {
  const r = normalizeUserRoleOrClient(role);
  const staff = staffRoles;
  return (
    roleHasCapability(r, "auction.manage", staff) || roleHasCapability(r, "catalogue.write", staff)
  );
}

function applySealedBidMask(lot: Lot): Lot {
  return { ...lot, currentPrice: lot.startingPrice };
}

function toPublicLotView(lot: Lot, reservePriceRef?: string): PublicLotView {
  const { reservePrice, ...rest } = lot;
  // reservePriceRef lets callers supply the real current price when lot.currentPrice has been
  // masked (e.g. sealed auction displays startingPrice but reserveMet must reflect real bids).
  const status = deriveReserveStatus(reservePriceRef ?? lot.currentPrice, reservePrice);
  return {
    ...rest,
    hasReserve: status.kind !== "none",
    reserveMet: status.kind === "none" ? null : status.kind === "met",
  };
}

/** Hide sealed high bids and reserve amounts from non-staff viewers. */
export function maskLotForPublicView(
  lot: Lot,
  role: string | undefined,
  staffRoles?: StaffRoles | undefined,
): Lot | PublicLotView {
  const canManage = viewerCanSeeStaffLotPricing(role, staffRoles);
  // Preserve the real current price before any sealed-bid masking so reserveMet stays accurate.
  const realCurrentPrice = lot.currentPrice;
  let masked = lot;

  if (lot.auctionType === "sealed" && lot.status === "active" && !canManage) {
    masked = applySealedBidMask(lot);
  }

  if (canManage) {
    return masked;
  }

  return toPublicLotView(masked, realCurrentPrice);
}

/** Always returns a public view (for web SSR when viewer is not staff). */
export function toPublicLotViewFromLot(lot: Lot): PublicLotView {
  const realCurrentPrice = lot.currentPrice;
  const sealedMasked =
    lot.auctionType === "sealed" && lot.status === "active" ? applySealedBidMask(lot) : lot;
  return toPublicLotView(sealedMasked, realCurrentPrice);
}

export { hasConfiguredReserve };
