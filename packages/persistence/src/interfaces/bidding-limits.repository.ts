import type { Database } from "@auction/db";

/** An organisation's own bidding limit, as the people managing it see it. */
export type OrganisationBiddingLimitRecord = {
  legalEntityId: string;
  /** Decimal string, GBP major units. */
  limitAmount: string;
  setByUserId: string | null;
  updatedAt: Date;
};

/** Reads an organisation's bidding limit. `conn` lets the bid transaction read it. */
export interface IOrganisationBiddingLimitReader {
  find(legalEntityId: string, conn?: Database): Promise<OrganisationBiddingLimitRecord | null>;
}

/** Sets or removes an organisation's bidding limit. */
export interface IOrganisationBiddingLimitWriter {
  /** Sets the limit and returns the amount it replaced, if any. */
  set(input: {
    legalEntityId: string;
    limitAmount: string;
    setByUserId: string;
  }): Promise<{ previousAmount: string | null }>;
  /** Removes the limit and returns the amount removed; `null` when there was none. */
  clear(legalEntityId: string): Promise<{ previousAmount: string | null }>;
}

export type BiddingExposureCommitmentKind =
  | "leading_bid"
  | "maximum_bid"
  | "absentee_bid"
  | "unpaid_win";

/** One thing an organisation has committed to on a lot (see `exposureOf` in the domain). */
export type BiddingExposureCommitmentRow = {
  lotId: string;
  saleId: string | null;
  /** The member who placed the bid or won the lot. */
  userId: string;
  kind: BiddingExposureCommitmentKind;
  /** Decimal string, GBP major units. */
  amount: string;
};

/**
 * Lists what an organisation has committed to and not yet settled: leading bids and maximum bids
 * that can still bid on lots still open, scheduled absentee bids, and lots won and not paid for.
 */
export interface IBiddingExposureReader {
  listCommitments(legalEntityId: string, conn?: Database): Promise<BiddingExposureCommitmentRow[]>;
}

/**
 * Serialises bids that are checked against an organisation's limits, so two bids on different
 * lots cannot both pass the check and together go past a limit. Held until `tx` ends.
 */
export interface IBiddingExposureLock {
  lockForLegalEntity(tx: Database, legalEntityId: string): Promise<void>;
}
