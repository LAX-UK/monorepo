export type PayoutStatementPayoutRow = {
  id: string;
  legalEntityId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  currency: string;
  xeroBillId: string | null;
  stripeTransferId: string | null;
  processedAt: Date | null;
};

export type PayoutStatementEntityRow = {
  id: string;
  legalName: string | null;
  displayName: string | null;
  vatNumber: string | null;
};

export type PayoutStatementLineRow = {
  lineId: string;
  kind: string;
  amount: string;
  note: string | null;
  paymentId: string | null;
  createdByUserId: string | null;
  lotTitle: string | null;
  lotNumber: number | null;
  buyerName: string | null;
  /** The lot was re-awarded to the next bidder after the first buyer did not pay. */
  soldAfterAuction: boolean;
  /** The private sale a line settles (its PS reference), never the buyer, who may stay anonymous. */
  dealReference: string | null;
};

export interface IPayoutStatementRepository {
  findPayoutById(payoutId: string): Promise<PayoutStatementPayoutRow | null>;
  findLegalEntityById(legalEntityId: string): Promise<PayoutStatementEntityRow | null>;
  findPayoutLines(payoutId: string): Promise<PayoutStatementLineRow[]>;
  findAuthorNames(userIds: string[]): Promise<Map<string, string>>;
  markStatementGenerated(payoutId: string, url: string): Promise<void>;
  markStatementError(payoutId: string, message: string): Promise<void>;
}
