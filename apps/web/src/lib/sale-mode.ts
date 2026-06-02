import type { SaleDeliveryMode } from "@auction/types";
import {
  getSaleModeCapabilities,
  saleModeAllowsBidding,
  saleModeAllowsStreamUrl,
} from "@auction/validators";

export function saleAllowsWebBidding(mode: SaleDeliveryMode): boolean {
  return saleModeAllowsBidding(mode);
}

export function saleAllowsStreamUrl(mode: SaleDeliveryMode): boolean {
  return saleModeAllowsStreamUrl(mode);
}

export function saleInheritsLotTiming(mode: SaleDeliveryMode): boolean {
  return getSaleModeCapabilities(mode).inheritsLotTiming;
}
