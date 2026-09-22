export type StripeCheckoutCompletedDto = {
  eventId: string;
  paidAt: Date;
  orderId: string;
  amountTotalPence: number;
  customerEmail?: string | null;
};

export type StripeCheckoutExpiredDto = {
  eventId: string;
  orderId: string;
};

export type StripeCheckoutAsyncFailedDto = {
  eventId: string;
  orderId: string;
};
