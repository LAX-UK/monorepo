/**
 * Subset of the GAP API (OpenAPI 2, `https://api.globalauctionplatform.com/swagger/docs/v1`)
 * used by the LAX integration. Field names match the wire format exactly.
 */

export type GapAuctionTypeAndListing =
  | "CatalogueLive"
  | "Live"
  | "Timed"
  | "CatalogueTimed"
  | "Tender";

export type GapAuctionListing = {
  PlatformCode: string;
  AuctionTypeAndListing: GapAuctionTypeAndListing;
  /** Server-required in practice although optional in Swagger. */
  CategoryName: string;
  Private: boolean;
};

export type GapAuctionDate = {
  Starts: string;
  Ends: string;
};

/** Fields shared by `CreateAuctionRequest` and `UpdateAuctionRequest`. */
export type GapAuctionFields = {
  Title: string;
  ClientId?: string;
  AuctionListings: GapAuctionListing[];
  /** Windows timezone ID (e.g. `GMT Standard Time`), not IANA. */
  TimezoneId: string;
  Currency: string;
  CountryCode: string;
  IncrementSetId: string;
  BuyersPremium?: number;
  Address1?: string;
  Address2?: string;
  TownCity?: string;
  Postcode?: string;
  Country?: string;
  ImportantInformation?: string;
  Terms?: string;
  TimedStart?: string;
  TimedFirstLotEnds?: string;
  SaleDates?: GapAuctionDate[];
  ClientsAuctionId?: string;
};

export type GapCreateAuctionRequest = GapAuctionFields;
export type GapUpdateAuctionRequest = GapAuctionFields & { AuctionId: string };

/** Fields shared by `CreateLotRequest` and `UpdateLotRequest`. */
export type GapLotFields = {
  AuctionId: string;
  /** Max 20 chars, unique within the auction. */
  LotNumber: string;
  /** Max 100 chars. */
  Title: string;
  /** Max 8000 chars; server-required in practice. */
  LongDescription: string;
  CategoryName: string;
  Quantity: number;
  SequenceNumber?: number;
  LowEstimate?: number;
  HighEstimate?: number;
  Reserve?: number;
  OpeningPrice?: number;
  BuyItNowPrice?: number;
  BuyersPremiumPercent?: number;
  EndTimeUtc?: string;
};

export type GapCreateLotRequest = GapLotFields;
export type GapUpdateLotRequest = GapLotFields & { LotId: string };

export type GapAddUrlImageToLotRequest = {
  LotId: string;
  /** `1` for the primary image, then `1-1`, `1-2`, … */
  ImageName: string;
  Url: string;
};

/** `GET /Lot/v2/GetLots/{auctionId}` item (fields LAX reads). */
export type GapLotResponse = {
  LotId?: string | null;
  LotNumber?: string | null;
  Status?: number | null;
  Sold?: boolean | null;
  HammerPrice?: number | null;
  CurrentMaxBid?: number | null;
  NumberOfBids?: number | null;
  WinningBidderId?: string | null;
  EndTimeUtc?: string | null;
};

/** `GET /Lot/GetSaleResults/{auctionId}` item (fields LAX reads). */
export type GapSaleResultResponse = {
  LotId?: string | null;
  LotNumber?: string | null;
  LotStatus?: string | null;
  NumberOfBids?: number | null;
  PaddleNumber?: string | null;
  HammerPrice?: number | null;
  TotalHammerPrice?: number | null;
  EndTimeUtc?: string | null;
};

/** ServiceStack error envelope returned by GAP on failures. */
export type GapErrorBody = {
  ResponseStatus?: { ErrorCode?: string; Message?: string } | null;
  Message?: string;
};
