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
  approveAuction(auctionId: string): Promise<void>;
  publishAuction(auctionId: string): Promise<void>;
  closeAuction(auctionId: string): Promise<void>;
  createLot(request: GapCreateLotRequest): Promise<{ lotId: string }>;
  updateLot(request: GapUpdateLotRequest): Promise<void>;
  /** Resolves when the lot is gone, including when ATG reports it already missing. */
  deleteLot(atgLotId: string): Promise<void>;
  addLotImageUrl(request: GapAddUrlImageToLotRequest): Promise<void>;
  getLots(auctionId: string): Promise<AtgRemoteLot[]>;
  getSaleResults(auctionId: string): Promise<AtgSaleResult[]>;
}
