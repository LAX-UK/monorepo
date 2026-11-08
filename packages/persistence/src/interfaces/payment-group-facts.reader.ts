import type { BidPaymentGroupFact } from "./bid-portfolio.reader.js";

/**
 * The combined payment each invoice is being settled through. Read alongside a list of
 * invoices, so a screen can say what a part-funded bank transfer still has to deliver.
 */
export interface IPaymentGroupFactsReader {
  /**
   * The group of each payment given, for the groups that are under way (`processing`). A payment
   * that is paid on its own, or whose group is open, settled or let go, is absent.
   */
  processingForPayments(paymentIds: readonly string[]): Promise<Map<string, BidPaymentGroupFact>>;
}
