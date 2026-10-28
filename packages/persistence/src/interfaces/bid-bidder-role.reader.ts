export type BidderRoleRow = {
  role: string;
  staffRole: string | null;
};

/** Reads the platform role of the account a bid is placed for. */
export interface IBidBidderRoleReader {
  /** `null` when the account has no bidding profile yet. */
  findBidderRole(userId: string): Promise<BidderRoleRow | null>;
}
