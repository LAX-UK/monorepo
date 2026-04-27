import type { SaleDeliveryMode } from "@auction/types";

/**
 * Single source of truth for what each sale delivery mode permits.
 *
 * Consumers (validators, services, route guards, UI gates) ask the policy
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
  /**
   * Whether lots inside a sale of this mode inherit the sale's
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
};

export function getSaleModeCapabilities(mode: SaleDeliveryMode): SaleModeCapabilities {
  return SALE_MODE_CAPABILITIES[mode];
}

export function saleModeAllowsBidding(mode: SaleDeliveryMode): boolean {
  return SALE_MODE_CAPABILITIES[mode].allowsBidding;
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
