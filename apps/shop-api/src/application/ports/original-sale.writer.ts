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
  stripeInvoiceId: string;
  hostedInvoiceUrl: string | null;
};

export type CompleteOriginalSalePaidCommand = {
  originalSaleId: string;
  stripeInvoiceId: string;
  paidAt: Date;
};

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
