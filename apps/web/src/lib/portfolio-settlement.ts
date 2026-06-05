import type { PortfolioRow } from "@auction/types";

/** User-facing label for settlement state on won lots. */
export function portfolioSettlementLabel(row: PortfolioRow): string {
  const { lot, payment } = row;
  if (lot.status !== "ended") {
    return "—";
  }
  if (!payment) {
    return "Awaiting payment";
  }
  switch (payment.status) {
    case "pending":
      return "Payment pending";
    case "authorized":
      return "Payment authorized";
    case "captured":
      return "Paid";
    case "refunded":
      return "Refunded";
    case "requires_manual_review":
      return "Under review";
    default:
      return "Awaiting payment";
  }
}
