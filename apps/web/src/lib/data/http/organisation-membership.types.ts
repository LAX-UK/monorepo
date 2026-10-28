/** A bid a former member left standing for the organisation, as the Members tab shows it. */
export type FormerMemberOpenBidRow = {
  kind: "auto_bid" | "absentee";
  id: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  endsAt: string;
  memberUserId: string;
  memberName: string;
  maxAmount: string;
};
