import { resolveDeliveryModePresentation } from "@/lib/presenters/delivery-mode/resolve-delivery-mode";
import type { SaleDeliveryMode } from "@auction/types";
import { DeliveryModePill } from "@auction/ui";

type Props = {
  deliveryMode: SaleDeliveryMode;
  className?: string;
  iconOnly?: boolean;
};

/** Staff delivery-format chip — registry → Tag-Review pill. */
export function SaleDeliveryModeChip({ deliveryMode, className, iconOnly }: Props) {
  const presentation = resolveDeliveryModePresentation(deliveryMode);
  return (
    <DeliveryModePill
      mode={presentation.mode}
      label={presentation.label}
      {...(className ? { className } : {})}
      {...(iconOnly ? { iconOnly } : {})}
    />
  );
}
