import type { DotStatusPillTone } from "@auction/ui/components/dot-status-pill";

export type PortalPayoutStatus =
  | "pending_refund_period"
  | "due"
  | "paid"
  | "cancelled"
  | (string & {});

export function resolvePortalPayoutStatusPresentation(status: PortalPayoutStatus): {
  label: string;
  tone: DotStatusPillTone;
} {
  switch (status) {
    case "pending_refund_period":
      return { label: "In cancellation period", tone: "neutral" };
    case "due":
      return { label: "Due", tone: "pending" };
    case "paid":
      return { label: "Paid", tone: "success" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return { label: status.replace(/_/g, " "), tone: "neutral" };
  }
}
