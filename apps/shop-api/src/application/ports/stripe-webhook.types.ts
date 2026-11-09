export type StripeCheckoutCompletedDto = {
  eventId: string;
  paidAt: Date;
  orderId: string;
  sessionId: string;
  amountTotalPence: number;
  customerEmail?: string | null;
  /** The PaymentIntent that took the money; kept for finance when the order is closed. */
  paymentIntentId?: string | null;
  /** Whether Stripe sent the event from live mode. */
  livemode?: boolean;
};

export type StripeCheckoutExpiredDto = {
  eventId: string;
  orderId: string;
  sessionId: string;
};

export type StripeCheckoutAsyncFailedDto = {
  eventId: string;
  orderId: string;
  sessionId: string;
};
