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
   * Who issues the invoice: `stripe` (a Stripe Invoice, emailed by Stripe) or `books` (Zoho Books,
   * once Stripe has taken the payment through a Payment Link; no Stripe Invoice).
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
  | { paymentLinkId: string; amountPence: number; currency: string }
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
