import type { LotStatus } from "@auction/types";

/** Short label for static lot status pills when the timer classifier yields `unknown`. */
export function lotStatusMarketingShortLabel(status: LotStatus): string {
  switch (status) {
    case "active":
      return "Live";
    case "scheduled":
      return "Scheduled";
    case "ended":
      return "Sold";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    case "voided":
      return "Voided";
  }
}
