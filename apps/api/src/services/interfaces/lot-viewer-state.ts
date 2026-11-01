import type { LotPosition, LotRegistrationState } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/** The account a person is acting for when they look at a lot. */
export type LotViewerActor = {
  userId: string;
  legalEntityId: string;
  /** Their role in that account; a buyer agent must register for a sale before bidding on it. */
  memberRole: LegalEntityMemberRole;
};

/** The invoice behind a lot the viewer won. */
export type LotViewerPurchase = {
  id: string;
  status: "not_invoiced" | "due" | "overdue" | "processing" | "paid" | "refunded" | "cancelled";
  dueAt: string | null;
};

/** Where one person stands on one lot: the response of `GET /lots/:id/me`. */
export type LotViewerView = {
  lotId: string;
  registration: LotRegistrationState;
  /** The viewer must register for the lot's sale before bidding (buyer agents). */
  registrationRequired: boolean;
  position: LotPosition;
  myHighestBid: string | null;
  myMaxBid: string | null;
  purchase: LotViewerPurchase | null;
  /** A buyer agent's room under their limits for this lot; `null` when no limit applies. */
  agentLimitLeft: string | null;
};

/** One entry of `GET /users/me/lot-states`: only lots the viewer has bid on appear. */
export type LotCardStateView = {
  lotId: string;
  position: Exclude<LotPosition, "none">;
  /** The next valid bid, so an outbid card can offer "Bid £X". */
  nextBidAmount: string | null;
};

export interface ILotViewerStateService {
  /** `null` when the lot does not exist. */
  forLot(input: { actor: LotViewerActor; lotId: string }): Promise<LotViewerView | null>;
  forLots(input: { actor: LotViewerActor; lotIds: readonly string[] }): Promise<LotCardStateView[]>;
}
