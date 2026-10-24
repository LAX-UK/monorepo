import { formatDate } from "@/lib/format-money";
import type { PortalPayout } from "@auction/shop-contracts";

export type PayoutStatusVm = {
  /** "Paid 18 Sept 2026", "Due 2 Oct 2026", "Waiting for refund period to end". */
  label: string;
  tone: "success" | "pending" | "neutral";
  /** Whether the money has reached the seller, is still to come, or will not be paid. */
  stage: "paid" | "to_come" | "cancelled";
};

/**
 * A payout's state in plain words, dated when the date means something. Before the refund
 * period ends Shop holds a placeholder due date, so none is shown.
 */
export function describePayoutStatus(
  status: string,
  dates: Pick<PortalPayout, "payoutDueAt" | "paidAt"> | null,
): PayoutStatusVm {
  switch (status) {
    case "paid":
      return {
        label: dates?.paidAt ? `Paid ${formatDate(dates.paidAt)}` : "Paid",
        tone: "success",
        stage: "paid",
      };
    case "due":
      return {
        label: dates?.payoutDueAt ? `Due ${formatDate(dates.payoutDueAt)}` : "Due",
        tone: "pending",
        stage: "to_come",
      };
    case "pending_refund_period":
      return { label: "Waiting for refund period to end", tone: "neutral", stage: "to_come" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral", stage: "cancelled" };
    default:
      return { label: "Status not known", tone: "neutral", stage: "to_come" };
  }
}
