export type CreateOriginalSaleInvoiceInput = {
  originalSaleId: string;
  buyerEmail: string;
  buyerName?: string | undefined;
  description: string;
  amountPence: number;
  currency: "gbp";
  metadata: Record<string, string>;
};

export type CreateOriginalSaleInvoiceResult = {
  stripeInvoiceId: string;
  hostedInvoiceUrl: string | null;
};

export interface InvoiceGateway {
  createAndFinalizeOriginalSaleInvoice(
    input: CreateOriginalSaleInvoiceInput,
  ): Promise<CreateOriginalSaleInvoiceResult>;
}

/** What a buyer pays an original through when Books issues its invoice: no Stripe Invoice. */
export type CreateOriginalSalePaymentLinkInput = {
  originalSaleId: string;
  description: string;
  amountPence: number;
  currency: "gbp";
};

export type CreateOriginalSalePaymentLinkResult = {
  paymentLinkId: string;
  url: string;
};

/**
 * Stripe takes the payment for an original whose invoice Books issues (decision F17): a
 * single-use Payment Link for the stored price, tagged with the sale. Stripe issues no invoice.
 */
export interface OriginalSalePaymentGateway {
  createOriginalSalePaymentLink(
    input: CreateOriginalSalePaymentLinkInput,
  ): Promise<CreateOriginalSalePaymentLinkResult>;
}
