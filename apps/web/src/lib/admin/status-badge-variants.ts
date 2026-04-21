import type { PaymentStatus } from "@auction/types";

/** Matches `StatusBadge` `variant` prop in `@auction/ui`. */
export type AdminStatusBadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "live";

/** Maps catalog lot lifecycle to `StatusBadge` variants (OCP: extend map, not callers). */
export function lotStatusToBadgeVariant(status: string): AdminStatusBadgeVariant {
  switch (status) {
    case "active":
      return "live";
    case "scheduled":
      return "info";
    case "draft":
      return "neutral";
    case "ended":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function paymentStatusToBadgeVariant(status: PaymentStatus): AdminStatusBadgeVariant {
  switch (status) {
    case "captured":
      return "success";
    case "authorized":
      return "info";
    case "pending":
      return "warning";
    case "refunded":
      return "neutral";
    default:
      return "neutral";
  }
}
