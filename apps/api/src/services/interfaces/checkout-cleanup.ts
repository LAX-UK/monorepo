/**
 * What the capture of an invoice's payment needs from checkout housekeeping: once the invoice is
 * paid, its other open checkouts are closed so it cannot be paid a second time.
 */
export interface ICheckoutCleanupAfterCapture {
  /**
   * Closes the invoice's other checkouts, never the one that paid. Never throws: a failure is
   * reported by the implementation and must not undo the capture. Safe to repeat.
   */
  closeAfterCapture(paymentId: string, paidPaymentIntentId: string | null): Promise<void>;
}
