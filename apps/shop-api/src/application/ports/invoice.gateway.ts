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
