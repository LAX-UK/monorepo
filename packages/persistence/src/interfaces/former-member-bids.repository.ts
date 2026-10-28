import type { DbTransaction } from "./artist-delete.repository.js";

/** A standing bid a former member left for an organisation, which can still act for it. */
export type FormerMemberOpenBid = {
  /** An auto-bid maximum on a live lot, or an absentee bid waiting for its sale. */
  kind: "auto_bid" | "absentee";
  /** The absentee bid's id, or the lot's id for an auto-bid maximum (one per bidder and lot). */
  id: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  /** When the lot closes. */
  endsAt: Date;
  memberUserId: string;
  memberName: string;
  /** The most the bid may reach. */
  maxAmount: string;
};

/** Identifies one former member's bid to cancel. */
export type FormerMemberBidRef = {
  kind: FormerMemberOpenBid["kind"];
  id: string;
  memberUserId: string;
};

/** Reads and cancels the bids former members left standing for an organisation. */
export interface IFormerMemberBidsRepository {
  /** Open bids for the organisation by people who are no longer active members, newest lot first. */
  listForEntity(legalEntityId: string): Promise<FormerMemberOpenBid[]>;
  /** The same rows, for one former member. */
  listForMember(legalEntityId: string, memberUserId: string): Promise<FormerMemberOpenBid[]>;
  /**
   * Cancels one bid inside `tx` when it is still open and still a former member's. Returns the
   * cancelled bid, or `null` when there was nothing to cancel.
   */
  cancel(
    tx: DbTransaction,
    legalEntityId: string,
    ref: FormerMemberBidRef,
    reason: string,
  ): Promise<FormerMemberOpenBid | null>;
}
