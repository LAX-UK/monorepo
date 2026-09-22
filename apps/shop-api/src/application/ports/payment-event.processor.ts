export type PaymentEventProcessor = {
  completeCheckout(input: {
    eventId: string;
    orderId: string;
    amountTotalPence: number;
    paidAt: Date;
    customerEmail?: string | null;
  }): Promise<"processed" | "duplicate">;
  expireCheckout(input: {
    eventId: string;
    orderId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  failCheckout(input: {
    eventId: string;
    orderId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
};
