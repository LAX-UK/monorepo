import type { SaleDeliveryMode } from "@auction/types";

/** Single source of truth for what each sale delivery mode permits.
 * * Consumers (validators, services, route guards, UI gates) ask the policy
 * instead of branching on `deliveryMode` strings directly. New modes can be
 * added by extending this map without rewriting bid services, forms, and
 * lifecycle code in multiple places (Open/Closed).
 */
export type SaleModeCapabilities = {
  /** Whether buyers can place bids on lots that belong to a sale of this mode. */
  readonly allowsBidding: boolean;
  /** Whether a stream URL field is meaningful for this mode. */
  readonly allowsStreamUrl: boolean;
  /** Whether onsite-style location fields apply for this mode. */
  readonly allowsLocation: boolean;
  /** Whether lots inside a sale of this mode inherit the sale's
   * start/end window instead of carrying their own schedule.
   */
  readonly inheritsLotTiming: boolean;
};

const SALE_MODE_CAPABILITIES: Record<SaleDeliveryMode, SaleModeCapabilities> = {
  online: {
    allowsBidding: true,
    allowsStreamUrl: false,
    allowsLocation: false,
    inheritsLotTiming: false,
  },
  onsite: {
    allowsBidding: false,
    allowsStreamUrl: true,
    allowsLocation: true,
    inheritsLotTiming: true,
  },
  hybrid: {
    allowsBidding: true,
    allowsStreamUrl: true,
    allowsLocation: true,
    inheritsLotTiming: true,
  },
};

export function getSaleModeCapabilities(mode: SaleDeliveryMode): SaleModeCapabilities {
  return SALE_MODE_CAPABILITIES[mode];
}

export function saleModeAllowsBidding(mode: SaleDeliveryMode): boolean {
  return SALE_MODE_CAPABILITIES[mode].allowsBidding;
}

/** Operator/clerk placements (telephone, saleroom, absentee) on legacy onsite sales. */
export function saleModeAllowsOperatorBidding(mode: SaleDeliveryMode): boolean {
  return saleModeAllowsBidding(mode) || mode === "onsite";
}

export function saleModeAllowsStreamUrl(mode: SaleDeliveryMode): boolean {
  return SALE_MODE_CAPABILITIES[mode].allowsStreamUrl;
}

export function saleModeAllowsLocation(mode: SaleDeliveryMode): boolean {
  return SALE_MODE_CAPABILITIES[mode].allowsLocation;
}

export function saleModeInheritsLotTiming(mode: SaleDeliveryMode): boolean {
  return SALE_MODE_CAPABILITIES[mode].inheritsLotTiming;
}

/** Modes that support live saleroom session, paddle check-in, and telephone bookings. */
export function isSaleroomDeliveryMode(mode: SaleDeliveryMode): boolean {
  return mode === "onsite" || mode === "hybrid";
}

type SaleroomOnlineBidGatePick = {
  deliveryMode: SaleDeliveryMode;
  allowOnlineBidsBeforeGoLive?: boolean | undefined;
};

/** Hybrid sales gated behind clerk Go Live + on-block lot (default). */
export function isSaleroomGatedForOnlineBids(sale: SaleroomOnlineBidGatePick): boolean {
  return sale.deliveryMode === "hybrid" && !sale.allowOnlineBidsBeforeGoLive;
}
