import type { Database } from "@auction/db";
import type {
  PlacedBid,
  PriorOffer,
  ReofferRecord,
  ReofferStatus,
  SellerConsentStatus,
} from "@auction/domain";
import type { LotStatus, PaymentStatus } from "@auction/types";
import type { LotReofferView, SellerConsentTerms } from "./lot-reoffer.js";

/** The lot as read under its row lock: what every re-offer step re-checks before it writes. */
export type ReofferLockedLot = {
  id: string;
  title: string;
  lotNumber: number | null;
  status: LotStatus;
  saleId: string | null;
  winnerId: string | null;
  sellerLegalEntityId: string | null;
  /** Whole pence; `null` when no reserve was agreed. */
  reservePence: number | null;
  deleted: boolean;
};

/** The failed sale an offer answers. The hammer and buyer stay here until a re-award. */
export type ReofferDefaultFacts = {
  id: string;
  lotId: string;
  buyerId: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  /** Whole pence. */
  hammerPence: number;
};

/** A placed bid with its id, for the offer to point at. The hidden auto-bid maximum is not here. */
export type PlacedBidWithId = PlacedBid & { bidId: string };

/**
 * What the re-offer steps read. Every method takes the caller's `Database` so it runs inside the
 * caller's transaction: the lot is locked first, then everything else is read under that lock.
 * Lock order is lot, then offer, the same as the re-award.
 */
export interface IReofferWorkflowReader {
  /** Takes the lot's row lock and returns it; `null` when the lot does not exist. */
  lockLot(tx: Database, lotId: string): Promise<ReofferLockedLot | null>;
  /** Which lot an offer is about, without locking anything: used to know which lot to lock. */
  lotIdOfOffer(db: Database, reofferId: string): Promise<string | null>;
  /** Takes the offer's row lock (after the lot's) and returns it. */
  lockOffer(tx: Database, reofferId: string): Promise<LotReofferView | null>;
  /** The lot's most recent buyer default. */
  latestDefault(db: Database, lotId: string): Promise<ReofferDefaultFacts | null>;
  defaultById(db: Database, buyerDefaultId: string): Promise<ReofferDefaultFacts | null>;
  /** Every payment on the lot, whatever its state. */
  paymentStatuses(db: Database, lotId: string): Promise<{ status: PaymentStatus }[]>;
  /** Every bid placed on the lot, with the standing of the account behind it. */
  placedBids(db: Database, lotId: string): Promise<PlacedBidWithId[]>;
  /** The default's other offers (not this one), as the rules read them. */
  otherOffers(
    db: Database,
    buyerDefaultId: string,
    exceptReofferId: string,
  ): Promise<ReofferRecord[]>;
  /** The default's offers so far, with who each went to. */
  priorOffers(db: Database, buyerDefaultId: string): Promise<PriorOffer[]>;
}

/** What staff see of one offer: the bidder and the seller's answer included. */
export type StaffReofferView = {
  offer: LotReofferView;
  offeredAccountName: string | null;
  /** When the bid the offer is made at was placed. */
  sourceBidPlacedAt: Date | null;
  /** The staff who started, or closed, the offer; `null` when the clock did. */
  createdByName: string | null;
  closedByName: string | null;
  consent: {
    id: string;
    status: SellerConsentStatus;
    channel: string | null;
    note: string | null;
    requestedAt: Date;
    dueAt: Date | null;
    remindedAt: Date | null;
    answeredAt: Date | null;
    /** Who answered: the seller's member, or the staff who recorded it; `null` for a lapse. */
    answeredByName: string | null;
    preferredNext: string | null;
    terms: SellerConsentTerms;
  } | null;
};

/** What the offered bidder's reads need of an offer. Nothing of the seller or the default. */
export type BidderReofferRow = {
  id: string;
  lotId: string;
  status: ReofferStatus;
  amountPence: number;
  offerSentAt: Date | null;
  offerEndsAt: Date | null;
  respondedAt: Date | null;
  offeredUserId: string;
  offeredLegalEntityId: string;
};

/** What the seller's reads need of a request: the terms they were shown, never who would buy. */
export type SellerConsentRequestRow = {
  reofferId: string;
  lotId: string;
  offerStatus: ReofferStatus;
  consentStatus: SellerConsentStatus;
  terms: SellerConsentTerms;
  dueAt: Date | null;
};

export interface IReofferViewsReader {
  /** Every offer of one lot, in the order they were made, for staff. */
  listForLot(lotId: string): Promise<StaffReofferView[]>;
  /** The offers made to one bidder account that the bidder has been told about. */
  listForBidderAccount(legalEntityId: string): Promise<BidderReofferRow[]>;
  findForBidderAccount(legalEntityId: string, reofferId: string): Promise<BidderReofferRow | null>;
  /** The requests made to one seller account. */
  listForSellerAccount(sellerLegalEntityId: string): Promise<SellerConsentRequestRow[]>;
  findForSellerAccount(
    sellerLegalEntityId: string,
    reofferId: string,
  ): Promise<SellerConsentRequestRow | null>;
}

/** The lot as the staff screens read it, without taking its lock. */
export type ReofferLotFacts = {
  id: string;
  status: LotStatus;
  winnerId: string | null;
  winnerLegalEntityId: string | null;
  /** Whole pence; `null` when no reserve was agreed. */
  reservePence: number | null;
  deleted: boolean;
};

/** The buyer default a re-offer answers, as staff read it. */
export type StaffBuyerDefaultView = {
  id: string;
  recordedAt: Date;
  recordedByName: string | null;
  reason: string;
  outcome: string;
  /** Whole pence. */
  originalHammerPence: number;
  wonAt: Date;
  buyerRestricted: boolean;
  buyerUserId: string;
  buyerAccountName: string | null;
  /** The voided invoice's own number and due date, when one was raised. */
  voidedInvoiceNumber: string | null;
  voidedInvoiceTotalPence: number | null;
  voidedInvoiceDueAt: Date | null;
};

/** What the staff preview of the next bidder needs beyond the bids. */
export interface IReofferStaffReader {
  lotFacts(db: Database, lotId: string): Promise<ReofferLotFacts | null>;
  latestDefaultView(db: Database, lotId: string): Promise<StaffBuyerDefaultView | null>;
  /** Account display names, for staff to read the bidders by name. */
  accountNames(db: Database, legalEntityIds: readonly string[]): Promise<Map<string, string>>;
}
