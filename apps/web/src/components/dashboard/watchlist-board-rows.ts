import { formatMoney } from "@/lib/format-currency";
import type { LotCardTimingVM } from "@auction/types";

export type WatchlistBoardRow = {
  watchlistId: string;
  lotId: string;
  title: string;
  artistLabel: string;
  image: string | null;
  medium: string | null;
  lotNumber: number | null;
  estimateLabel: string;
} & LotCardTimingVM;

export function estimateLabel(row: {
  estimate: { low: string; high: string; currency: string } | undefined;
  fallback: string;
}): string {
  if (!row.estimate) return formatMoney(row.fallback);
  return `${row.estimate.currency} ${row.estimate.low} – ${row.estimate.high}`;
}
