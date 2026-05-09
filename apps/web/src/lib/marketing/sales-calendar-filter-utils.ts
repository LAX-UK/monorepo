import type { SaleListRow } from "@/lib/data/http/sales.server";
import type { SaleDeliveryMode } from "@auction/types";

export type CalendarRowFilters = {
  deliveryMode?: SaleDeliveryMode | "all";
  location?: "all" | "online" | string;
  month?: number;
  year?: number;
  minPrice?: number;
  maxPrice?: number;
};

function lotPriceInRange(
  row: SaleListRow,
  min: number | undefined,
  max: number | undefined,
): boolean {
  if (min == null && max == null) return true;
  const prices = row.lots
    .map((l) => Number.parseFloat(l.currentPrice))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (prices.length === 0) return false;
  const hi = Math.max(...prices);
  const lo = Math.min(...prices);
  if (min != null && hi < min) return false;
  if (max != null && lo > max) return false;
  return true;
}

/** Client/server-safe row filter for query params not yet supported by `GET /sales`. */
export function applyCalendarRowFilters(rows: SaleListRow[], f: CalendarRowFilters): SaleListRow[] {
  return rows.filter(({ sale, lots }) => {
    if (f.deliveryMode && f.deliveryMode !== "all" && sale.deliveryMode !== f.deliveryMode) {
      return false;
    }
    if (f.location && f.location !== "all") {
      if (f.location === "online") {
        if (sale.deliveryMode !== "online") return false;
      } else {
        const city = sale.locationCity?.toLowerCase() ?? "";
        if (!city.includes(f.location.toLowerCase())) return false;
      }
    }
    if (f.month != null) {
      const m = new Date(sale.startTime).getMonth() + 1;
      if (m !== f.month) return false;
    }
    if (f.year != null) {
      const y = new Date(sale.startTime).getFullYear();
      if (y !== f.year) return false;
    }
    if (!lotPriceInRange({ sale, lots }, f.minPrice, f.maxPrice)) return false;
    return true;
  });
}
