import type { Sale } from "@auction/types";

/** Short venue/location line for marketing lists (aligned with saleroom hero). */
export function saleMarketingLocationLabel(sale: Sale): string | null {
  if (sale.deliveryMode === "online") return "Online";
  return (
    sale.locationCity?.trim() || sale.locationName?.trim() || sale.locationCounty?.trim() || null
  );
}
