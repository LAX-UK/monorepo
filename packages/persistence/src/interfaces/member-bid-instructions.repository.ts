import type { DbTransaction } from "./artist-delete.repository.js";

/**
 * A standing instruction a member gave to bid for an organisation: an auto-bid ceiling on a lot,
 * or an absentee bid. Placed bids are not instructions.
 */
export type StandingBidInstruction = {
  kind: "auto_bid" | "absentee";
  /** The absentee bid's id, or the lot's id for an auto-bid ceiling (one per bidder and lot). */
  id: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  /** The lot's status, so the domain can decide whether the instruction can still bid. */
  lotStatus: string;
  /** The absentee bid's status; `null` for an auto-bid ceiling. */
  instructionStatus: string | null;
  /** The most the instruction may reach. */
  maxAmount: string;
};

/** A member's standing instructions for an organisation, read and stopped inside a transaction. */
export interface IMemberBidInstructionsRepository {
  /** Instructions the member holds for the organisation that may still be open. */
  listForMember(
    tx: DbTransaction,
    legalEntityId: string,
    memberUserId: string,
  ): Promise<StandingBidInstruction[]>;
  /** Stops one instruction. Returns `false` when it was no longer open (nothing to record). */
  stop(
    tx: DbTransaction,
    legalEntityId: string,
    memberUserId: string,
    instruction: Pick<StandingBidInstruction, "kind" | "id" | "lotId">,
    reason: string,
  ): Promise<boolean>;
}
