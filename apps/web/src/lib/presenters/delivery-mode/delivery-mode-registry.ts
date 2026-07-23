import type { SaleDeliveryMode } from "@auction/types";
import type { DeliveryModeTagKey } from "@auction/ui";

export type DeliveryModePresentation = {
  label: string;
  mode: DeliveryModeTagKey;
};

export const DELIVERY_MODE_REGISTRY: Record<SaleDeliveryMode, DeliveryModePresentation> = {
  online: { label: "Online", mode: "online" },
  onsite: { label: "Onsite", mode: "onsite" },
  hybrid: { label: "Hybrid", mode: "hybrid" },
};

export function deliveryModeShortLabel(mode: SaleDeliveryMode): string {
  return DELIVERY_MODE_REGISTRY[mode].label;
}
