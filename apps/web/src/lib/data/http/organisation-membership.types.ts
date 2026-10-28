/** Automatic bids that stopped when one member left the organisation. */
export type StoppedMemberBidsRow = {
  memberUserId: string;
  memberName: string;
  /** ISO 8601. */
  stoppedAt: string;
  bids: {
    kind: "auto_bid" | "absentee";
    lotId: string;
    lotTitle: string;
    lotNumber: number | null;
    maxAmount: string;
  }[];
};
