import type { SaleDeliveryMode } from "@auction/types";
import { DELIVERY_MODE_REGISTRY, type DeliveryModePresentation } from "./delivery-mode-registry";

/** Sale delivery mode → staff Tag-Review chip props. */
export function resolveDeliveryModePresentation(mode: SaleDeliveryMode): DeliveryModePresentation {
  return DELIVERY_MODE_REGISTRY[mode];
}

export type { DeliveryModePresentation };
