import { SaleDeliveryModeChip } from "@/components/admin/sale-delivery-mode-chip";
import { resolveDotStatusPresentation } from "@/lib/presenters/status/resolver";
import type { SaleDeliveryMode, SaleStatus } from "@auction/types";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

type SaleStatusPillProps = {
  status: SaleStatus;
  className?: string;
  iconOnly?: boolean;
};

type SaleDeliveryPillProps = {
  deliveryMode: SaleDeliveryMode;
  className?: string;
  iconOnly?: boolean;
};

/** Figma dot-pill for sale lifecycle status. */
export function SaleStatusPill({ status, className, iconOnly }: SaleStatusPillProps) {
  const presentation = resolveDotStatusPresentation("sale", status);
  const label =
    status === "scheduled" ? "Upcoming" : status === "active" ? "Live" : presentation.label;
  return (
    <DotStatusPill
      label={label}
      tone={presentation.tone}
      {...(className ? { className } : {})}
      {...(iconOnly ? { iconOnly } : {})}
    />
  );
}

/** Figma delivery-format pill (Online / Onsite / Hybrid). */
export function SaleDeliveryPill({ deliveryMode, className, iconOnly }: SaleDeliveryPillProps) {
  return (
    <SaleDeliveryModeChip
      deliveryMode={deliveryMode}
      {...(className ? { className } : {})}
      {...(iconOnly ? { iconOnly } : {})}
    />
  );
}
