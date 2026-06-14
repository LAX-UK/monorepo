import type { ManualReviewReason, PortfolioRow } from "@auction/types";

/** User-facing label for settlement state on won lots. */
export function portfolioSettlementLabel(row: PortfolioRow): string {
  const { lot, payment } = row;
  if (lot.status !== "ended") {
    return "—";
  }
  if (!payment) {
    return "Awaiting payment";
  }
  if (
    payment.manualReviewReason === "aml_hold" ||
    payment.manualReviewReason === "source_of_funds_required"
  ) {
    return "Compliance review";
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

/**
 * Returns the compliance reason from a portfolio row's payment, or null.
 * Used by the portfolio card to decide whether to disable the checkout CTA.
 */
export function portfolioComplianceReason(row: PortfolioRow): ManualReviewReason | null {
  const reason = row.payment?.manualReviewReason ?? null;
  if (reason === "aml_hold" || reason === "source_of_funds_required") return reason;
  return null;
}
