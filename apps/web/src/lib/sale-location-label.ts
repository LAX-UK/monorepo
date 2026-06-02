import { getSaleDeliveryModeLabel } from "@/lib/sale-type-presentation";
import type { Sale } from "@auction/types";

/** Short venue/location line for marketing lists (aligned with saleroom hero). */
export function saleMarketingLocationLabel(sale: Sale): string | null {
  if (sale.deliveryMode === "online") return getSaleDeliveryModeLabel("online");
  return (
    sale.locationCity?.trim() || sale.locationName?.trim() || sale.locationCounty?.trim() || null
  );
}
