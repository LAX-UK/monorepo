/**
 * Raw facts behind a person's LAX portfolio and money for Shop and lax.art. They follow the
 * same ownership rules as the owner-portal reads (the person's own party plus a linked artist
 * party) but add what those reads leave out: who made the work, its image, what was paid and
 * how far fulfilment has got. All amounts are integer pence in GBP.
 */
export type PortfolioChannel = "shop" | "art";

export type PortfolioWork = {
  artworkId: string;
  slug: string;
  title: string;
  /** Display name of the artist; empty when none is recorded. */
  artistName: string;
  /** Stored media reference of the primary image, not yet a public URL. */
  imageKey: string | null;
  channel: PortfolioChannel;
};

export type PortfolioPurchase = {
  orderId: string;
  orderStatus: string;
  channel: PortfolioChannel;
  paidAt: Date | null;
  unitPricePence: number;
  /** The order's delivery charge, carried on the first line of the order only. */
  shippingPence: number;
  /** Null until fulfilment has been set up for the order. */
  fulfilmentStatus: string | null;
};

export type PortfolioEditionFact = {
  editionId: string;
  work: PortfolioWork;
  editionNumber: number;
  /** Whether the owner has offered this edition for sale (`authorised`, `reserved`, `held`...). */
  listingStatus: string;
  /** Null for an edition granted rather than bought (artist or LAX allocation). */
  purchase: PortfolioPurchase | null;
  /** When the edition record was created; stands in for the acquisition date of a granted edition. */
  createdAt: Date;
  certificate: "issued" | "expected" | "none";
};

export type PortfolioOriginalFact = {
  originalSaleId: string;
  work: PortfolioWork;
  channel: PortfolioChannel;
  status: "deposit_due" | "invoiced" | "paid" | "assigned";
  salePricePence: number;
  /** When the sale last changed state; the sale carries no separate purchase date. */
  updatedAt: Date;
};

/** An edition on an order that is waiting for payment. */
export type PortfolioPendingOrderLineFact = {
  orderLineId: string;
  orderId: string;
  channel: PortfolioChannel;
  work: PortfolioWork;
  editionNumber: number | null;
  unitPricePence: number;
  shippingPence: number;
  createdAt: Date;
};

/** One payout owed to or paid to the person for something they sold. */
export type PortfolioSaleFact = {
  payoutId: string;
  /** The work that was sold; null if the sale can no longer be traced to an artwork. */
  work: PortfolioWork | null;
  grossPence: number;
  deductionsPence: number;
  netPence: number;
  status: string;
  payoutDueAt: Date;
  paidAt: Date | null;
  createdAt: Date;
};

export type PortfolioOrderFact = {
  orderId: string;
  channel: PortfolioChannel;
  status: string;
  totalPence: number;
  paidAt: Date | null;
  createdAt: Date;
  checkoutExpiresAt: Date | null;
};

export type PortfolioRefundFact = {
  refundId: string;
  orderId: string;
  channel: PortfolioChannel;
  amountPence: number;
  status: string;
  createdAt: Date;
};

export type PortalPortfolioFacts = {
  editions: PortfolioEditionFact[];
  originals: PortfolioOriginalFact[];
  pendingOrderLines: PortfolioPendingOrderLineFact[];
  /** Sales paid out through the payout ledger; empty unless the caller asked for them. */
  sales: PortfolioSaleFact[];
  orders: PortfolioOrderFact[];
  refunds: PortfolioRefundFact[];
};

export interface PortalPortfolioReader {
  loadFacts(
    identitySubjectId: string,
    options: { includeSales: boolean },
  ): Promise<PortalPortfolioFacts>;
}
