/**
 * Raw facts about one person's personal legal entity, for the LAX portfolio and money reads.
 * Organisations are deliberately absent: their holdings and money stay inside Bid.
 *
 * Amounts are the `numeric(18,2)` strings the database returns; the application layer turns
 * them into the portfolio contract. Every list is newest first and capped, so one prolific
 * account cannot make a request unbounded.
 */
export type BidWonLotFact = {
  lotId: string;
  title: string;
  artistName: string | null;
  /** Stored media key of the first image, not yet a public URL. */
  firstImageKey: string | null;
  /** The winning bid, before the buyer's premium. */
  hammerPrice: string;
  endedAt: Date;
  fulfilmentStatus: string | null;
};

export type BidPaymentFact = {
  id: string;
  lotId: string;
  /** Total settlement amount including the buyer's premium. */
  amount: string;
  status:
    | "pending"
    | "authorized"
    | "captured"
    | "refunded"
    | "requires_manual_review"
    | "cancelled";
  createdAt: Date;
  hasInvoice: boolean;
};

export type BidSubmissionFact = {
  id: string;
  title: string;
  firstImageKey: string | null;
  createdAt: Date;
};

export type BidSellerLotFact = {
  lotId: string;
  title: string;
  artistName: string | null;
  firstImageKey: string | null;
  /** `in_sale` while the lot is scheduled or live; `sold` once it closed with a winner. */
  stage: "in_sale" | "sold";
  /** When the lot closed (sold) or was created (in sale). */
  occurredAt: Date;
  /** Whether the winning buyer's payment was captured. */
  buyerPaid: boolean;
  /** Status of the payout carrying this lot's sale, when one exists. */
  payoutStatus: string | null;
  /** Whether that payout has a statement PDF the person can open. */
  payoutHasStatement: boolean;
};

export type BidPayoutFact = {
  id: string;
  currency: string;
  netAmount: string;
  platformFee: string;
  stripeFee: string;
  status: string;
  periodEnd: Date;
  processedAt: Date | null;
  hasStatement: boolean;
};

export type BidPortfolioFacts = {
  wonLots: BidWonLotFact[];
  payments: BidPaymentFact[];
  submissions: BidSubmissionFact[];
  sellerLots: BidSellerLotFact[];
  payouts: BidPayoutFact[];
};

export interface IBidPortfolioReader {
  /** Empty facts when the person has no personal legal entity yet. */
  loadForPerson(userId: string): Promise<BidPortfolioFacts>;
}
