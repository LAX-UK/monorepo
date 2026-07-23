import type { PaymentStatus, PayoutStatus } from "@auction/types";
import type { StatusBadgeVariant } from "./core";

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Pending",
  authorized: "Authorized",
  captured: "Captured",
  refunded: "Refunded",
  requires_manual_review: "Manual review",
  cancelled: "Cancelled",
};

export function paymentStatusToBadgeVariant(status: PaymentStatus): StatusBadgeVariant {
  switch (status) {
    case "captured":
      return "success";
    case "authorized":
      return "info";
    case "pending":
    case "requires_manual_review":
      return "warning";
    case "refunded":
      return "neutral";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export const payoutStatusLabel: Record<PayoutStatus, string> = {
  scheduled: "Scheduled",
  in_transit: "In transit",
  paid: "Paid",
  failed: "Failed",
  reversed: "Reversed",
  clawback_pending: "Clawback pending",
};

export function payoutStatusToBadgeVariant(status: PayoutStatus | string): StatusBadgeVariant {
  switch (status) {
    case "paid":
      return "success";
    case "in_transit":
      return "info";
    case "scheduled":
      return "neutral";
    case "failed":
    case "clawback_pending":
      return "danger";
    case "reversed":
      return "danger";
    default:
      return "neutral";
  }
}
