export type PaymentEventProcessor = {
  completeCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    amountTotalPence: number;
    paidAt: Date;
    customerEmail?: string | null;
  }): Promise<"processed" | "duplicate" | "terminal_acknowledged">;
  expireCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  failCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  recordCurrencyViolation(input: {
    eventId: string;
    orderId: string;
    currency: string;
    sessionId: string;
  }): Promise<"processed" | "duplicate">;
};
