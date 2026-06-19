import { lotStatusFilterLabel } from "@/lib/marketing/marketing-status-filters";
import type { LotStatus } from "@auction/types";

export type SearchEndingWindow = "24h";

const LOT_STATUSES: readonly LotStatus[] = ["draft", "scheduled", "active", "ended", "cancelled"];

export function parseSearchStatus(raw: string | undefined): LotStatus | undefined {
  if (!raw) return undefined;
  return LOT_STATUSES.includes(raw as LotStatus) ? (raw as LotStatus) : undefined;
}

export function parseSearchEnding(raw: string | undefined): SearchEndingWindow | undefined {
  return raw === "24h" ? "24h" : undefined;
}

export function searchStatusLabel(status: LotStatus): string {
  return lotStatusFilterLabel(status);
}

export function searchEndingLabel(window: SearchEndingWindow): string {
  return window === "24h" ? "Ending within 24 hours" : window;
}
