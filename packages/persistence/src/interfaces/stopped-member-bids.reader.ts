/** One automatic bid that stopped when its member left. */
export type StoppedMemberBid = {
  kind: "auto_bid" | "absentee";
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  maxAmount: string;
};

/** Everything that stopped for one former member, from the audit entries. */
export type StoppedMemberBids = {
  memberUserId: string;
  memberName: string;
  stoppedAt: Date;
  bids: StoppedMemberBid[];
};

/** Automatic bids that stopped when members left an organisation, newest first. */
export interface IStoppedMemberBidsReader {
  listSince(legalEntityId: string, since: Date): Promise<StoppedMemberBids[]>;
}
