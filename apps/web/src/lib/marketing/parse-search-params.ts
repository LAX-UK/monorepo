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
  switch (status) {
    case "active":
      return "Live now";
    case "scheduled":
      return "Upcoming";
    case "ended":
      return "Ended";
    default:
      return status;
  }
}

export function searchEndingLabel(window: SearchEndingWindow): string {
  return window === "24h" ? "Ending within 24 hours" : window;
}
