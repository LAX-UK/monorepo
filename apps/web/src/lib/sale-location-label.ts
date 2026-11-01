import { getSaleDeliveryModeLabel } from "@/lib/sale-type-presentation";
import type { Sale } from "@auction/types";

/**
 * The place a sale happens, for a card or hero that already names the format: null for an online
 * sale, whose format says so, so "Online" is never shown twice.
 */
export function saleVenueLabel(sale: Sale): string | null {
  return sale.deliveryMode === "online" ? null : saleMarketingLocationLabel(sale);
}

/** Short venue/location line for marketing lists (aligned with saleroom hero). */
export function saleMarketingLocationLabel(sale: Sale): string | null {
  if (sale.deliveryMode === "online") return getSaleDeliveryModeLabel("online");
  return (
    sale.locationCity?.trim() || sale.locationName?.trim() || sale.locationCounty?.trim() || null
  );
}
