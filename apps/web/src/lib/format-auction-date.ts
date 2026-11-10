import { LONDON_TIME_ZONE, formatDateRange, formatWhen } from "@auction/datetime";
import type { Lot, Sale } from "@auction/types";

/** Hero meta line for a live lot: "Closes Tue 3 Nov, 21:00 GMT". */
export function formatLotAuctionLine(lot: Pick<Lot, "endTime">): string {
  return `Closes ${formatWhen(lot.endTime, LONDON_TIME_ZONE, new Date())}`;
}

/** Sale card subtitle: "9–16 Apr 2026", "29 Oct – 3 Nov 2026". */
export function formatSaleDateRange(sale: Pick<Sale, "startTime" | "endTime">): string {
  return formatDateRange(sale.startTime, sale.endTime, LONDON_TIME_ZONE);
}
