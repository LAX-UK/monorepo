import type {
  GapAddUrlImageToLotRequest,
  GapCreateAuctionRequest,
  GapCreateLotRequest,
  GapUpdateAuctionRequest,
  GapUpdateLotRequest,
} from "./gap-types.js";

/** Remote lot state as polled from ATG (dates parsed, nulls normalised). */
export type AtgRemoteLot = {
  atgLotId: string;
  lotNumber: string | null;
  status: number | null;
  sold: boolean | null;
  hammerPrice: number | null;
  currentMaxBid: number | null;
  numberOfBids: number | null;
  winningBidderId: string | null;
  endTimeUtc: Date | null;
};

/** One `GetSaleResults` row without bidder names (data minimisation). */
export type AtgSaleResult = {
  atgLotId: string | null;
  lotNumber: string | null;
  lotStatus: string | null;
  numberOfBids: number | null;
  paddleNumber: string | null;
  hammerPrice: number | null;
  totalHammerPrice: number | null;
  endTimeUtc: string | null;
};

/**
 * The charges ATG holds on an auction, in GAP's own units: the rates are percentages (25 = 25%)
 * and the VAT rates are multipliers (0.2 = 20%). Null when ATG did not return the field.
 */
export type AtgRemoteAuctionFees = {
  buyersPremium: number | null;
  buyersPremiumVatRate: number | null;
  internetSurchargeRate: number | null;
  internetSurchargeVatRate: number | null;
};

/** Auction state as ATG reports it. */
export type AtgRemoteAuction = {
  atgAuctionId: string;
  /** The `ClientsAuctionId` LAX sent on create (the LAX sale id). */
  clientsAuctionId: string | null;
  isApproved: boolean;
  isPublished: boolean;
  statusCode: number | null;
  fees: AtgRemoteAuctionFees;
};

/** Surcharge rates ATG holds on the client; null when it holds none. */
export type AtgClientSurchargeRates = {
  defaultRate: number | null;
  alternativeRate: number | null;
};

/** An increment set available to the ATG client. */
export type AtgIncrementSet = { incrementSetId: string; name: string | null };

/**
 * Failure from the ATG API. `retryable` is true for network errors, timeouts, 408/429 and
 * 5xx; false for validation/auth errors that will fail again unchanged.
 */
export class AtgGatewayError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status: number | null,
    readonly operation: string,
  ) {
    super(message);
    this.name = "AtgGatewayError";
  }
}

/** Narrow port over the GAP API operations LAX uses. */
export interface AtgGateway {
  createAuction(request: GapCreateAuctionRequest): Promise<{ auctionId: string }>;
  updateAuction(request: GapUpdateAuctionRequest): Promise<void>;
  /** ATG staff must have approved the auction in Toolbox first. */
  publishAuction(auctionId: string): Promise<void>;
  closeAuction(auctionId: string): Promise<void>;
  createLot(request: GapCreateLotRequest): Promise<{ lotId: string }>;
  updateLot(request: GapUpdateLotRequest): Promise<void>;
  /** Resolves when the lot is gone, including when ATG reports it already missing. */
  deleteLot(atgLotId: string): Promise<void>;
  addLotImageUrl(request: GapAddUrlImageToLotRequest): Promise<void>;
  getLots(auctionId: string): Promise<AtgRemoteLot[]>;
  getSaleResults(auctionId: string): Promise<AtgSaleResult[]>;
  /** Null when ATG does not know the auction. */
  getAuction(auctionId: string): Promise<AtgRemoteAuction | null>;
  /** Auctions of the client starting from `fromDate`; used to find a create whose reply was lost. */
  findAuctionsByClientId(clientId: string, fromDate: Date): Promise<AtgRemoteAuction[]>;
  /** The client's own internet surcharge rates, which ATG falls back to on an auction. */
  getClientSurchargeRates(clientId: string): Promise<AtgClientSurchargeRates>;
  getIncrementSets(clientId: string): Promise<AtgIncrementSet[]>;
  /** Category names accepted for the platform. */
  getSupportedCategories(platformCode: string): Promise<string[]>;
}
