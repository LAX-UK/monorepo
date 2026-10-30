import { INVOICE_PAYMENT_DUE_DAYS, type LotStatus, type PaymentStatus } from "@auction/types";

/**
 * The short states search shows on a result's second line. Each is decided here from facts, so
 * the palette, the lists and any export say the same thing.
 */

/** Where a won lot's payment stands. */
export type PurchasePaymentState = "due" | "overdue" | "processing" | "paid" | "refunded";

const DAY_MS = 86_400_000;

/**
 * Payment is due `INVOICE_PAYMENT_DUE_DAYS` after the invoice is raised: the payment row's
 * creation, or the lot's end when no payment was started (the invoice is raised at the close).
 */
export function purchasePaymentState(input: {
  paymentStatus: PaymentStatus | null;
  invoicedAt: Date;
  now: Date;
}): PurchasePaymentState {
  switch (input.paymentStatus) {
    case "captured":
      return "paid";
    case "authorized":
      return "processing";
    case "refunded":
      return "refunded";
    default: {
      const dueAt = input.invoicedAt.getTime() + INVOICE_PAYMENT_DUE_DAYS * DAY_MS;
      return input.now.getTime() > dueAt ? "overdue" : "due";
    }
  }
}

/** How a lot the account (or the member) bid on stands for them. */
export type BidOutcome = "leading" | "outbid" | "won" | "lost";

/**
 * Open lots are leading or outbid; closed lots are won or lost. A lot that has not opened, or was
 * cancelled or voided, has no outcome to show.
 */
export function bidOutcome(input: {
  lotStatus: LotStatus;
  leading: boolean;
  won: boolean;
}): BidOutcome | null {
  if (input.lotStatus === "active") return input.leading ? "leading" : "outbid";
  if (input.lotStatus === "ended") return input.won ? "won" : "lost";
  return null;
}
