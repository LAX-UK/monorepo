import { SaleDeliveryModeChip } from "@/components/admin/sale-delivery-mode-chip";
import type { SaleDeliveryMode } from "@auction/types";

type Props = {
  mode: SaleDeliveryMode;
  className?: string;
};

export function SaleDeliveryModeBadge({ mode, className }: Props) {
  return <SaleDeliveryModeChip deliveryMode={mode} {...(className ? { className } : {})} />;
}
