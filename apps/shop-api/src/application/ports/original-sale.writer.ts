export type CreateOriginalSaleCommand = {
  artworkId: string;
  buyerPartyId: string;
  salePricePence: number;
  reservationExpiresAt?: string | undefined;
  salesChannel?: "shop" | "art" | undefined;
  actorSubjectId: string;
};

export type CreateOriginalSaleResult = {
  originalSaleId: string;
  status: "reserved";
};

export type IssueOriginalSaleInvoiceCommand = {
  originalSaleId: string;
  buyerEmail: string;
  buyerName?: string | undefined;
  actorSubjectId: string;
  idempotencyKey: string;
};

export type IssueOriginalSaleInvoiceResult = {
  originalSaleId: string;
  status: "invoiced";
  /**
   * Who issues the invoice: `stripe` (a Stripe Invoice, emailed by Stripe to the buyer) or `books`
   * (only while the Shop is aimed at Books live: nothing is emailed now; the buyer pays through the
   * Payment Link, and Books emails its invoice once they have paid).
   */
  invoiceIssuer: "stripe" | "books";
  /** Null when Books issues the invoice. */
  stripeInvoiceId: string | null;
  /** Where the buyer pays: Stripe's invoice page, or the Payment Link when Books issues it. */
  hostedInvoiceUrl: string | null;
};

/** What Stripe says it took, checked against the stored sale before anything moves. */
export type CompleteOriginalSalePaidCommand = {
  originalSaleId: string;
  paidAt: Date;
} & (
  | { stripeInvoiceId: string }
  | {
      paymentLinkId: string;
      /** The Checkout Session and PaymentIntent that paid: stored, and the only replay allowed. */
      checkoutSessionId: string;
      paymentIntentId: string | null;
      amountPence: number;
      currency: string;
    }
);

export type CompleteOriginalSalePaidResult = {
  originalSaleId: string;
  status: "assigned";
};

export interface OriginalSaleWriter {
  createReservation(command: CreateOriginalSaleCommand): Promise<CreateOriginalSaleResult>;
  issueInvoice(command: IssueOriginalSaleInvoiceCommand): Promise<IssueOriginalSaleInvoiceResult>;
  completePaidAndAssign(
    command: CompleteOriginalSalePaidCommand,
  ): Promise<CompleteOriginalSalePaidResult>;
}
