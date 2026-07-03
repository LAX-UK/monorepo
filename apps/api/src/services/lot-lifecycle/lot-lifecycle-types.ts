import type { LotEndedTrigger } from "@auction/types";

export type LotCloseOutcome = {
  lotId: string;
  winnerId: string | null;
  voided: boolean;
  winningBid: import("@auction/types").Bid | null;
  trigger: LotEndedTrigger;
  hadBids: boolean;
};

export type LotCloseNotificationBidRepo = {
  listDistinctBidderIds(lotId: string): Promise<string[]>;
};
