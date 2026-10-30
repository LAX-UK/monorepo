import type { LotStatus } from "@auction/types";

/**
 * How a bid stands, for search's second line and the bids list. A purchase's payment state is
 * `purchaseInvoiceState` (one rule for invoices, built on `INVOICE_PAYMENT_DUE_DAYS`).
 */

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
