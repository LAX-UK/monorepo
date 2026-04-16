import type { PortfolioRow } from "@auction/types";

/** User-facing label for settlement state on won lots. */
export function portfolioSettlementLabel(row: PortfolioRow): string {
  const { auction, payment } = row;
  if (auction.status !== "ended") {
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
    default:
      return "Awaiting payment";
  }
}
