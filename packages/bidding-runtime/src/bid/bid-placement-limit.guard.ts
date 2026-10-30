import type { Database } from "@auction/db";
import type { IBidAuthority } from "./bid-authority.service.js";
import type { IBiddingLimitGate } from "./bidding-limit.gate.js";

export type BidPlacementLimitInput = {
  placedByUserId: string;
  buyerLegalEntityId: string;
  lotId: string;
  saleId: string | null;
  amount: number;
  maxAutoBidAmount?: number | undefined;
};

/** The bidding-limit check the bid transaction runs after it has locked the lot. */
export interface IBidPlacementLimitGuard {
  /** Throws a `BidError` when the bid would go past a limit. */
  assertInTransaction(tx: Database, input: BidPlacementLimitInput): Promise<void>;
}

/** The highest amount a bid commits the bidder to: the bid, or its auto-bid ceiling. */
export function committedAmount(input: {
  amount: number;
  maxAutoBidAmount?: number | null | undefined;
}): number {
  const max = input.maxAutoBidAmount;
  return max != null && Number.isFinite(max) ? Math.max(input.amount, max) : input.amount;
}

export class BidPlacementLimitGuard implements IBidPlacementLimitGuard {
  constructor(
    private readonly authority: IBidAuthority,
    private readonly gate: IBiddingLimitGate,
  ) {}

  async assertInTransaction(tx: Database, input: BidPlacementLimitInput): Promise<void> {
    const authority = await this.authority.resolve({
      userId: input.placedByUserId,
      legalEntityId: input.buyerLegalEntityId,
      saleId: input.saleId,
    });
    const result = await this.gate.checkInTransaction(tx, {
      legalEntityId: input.buyerLegalEntityId,
      placedByUserId: input.placedByUserId,
      lotId: input.lotId,
      saleId: input.saleId,
      amount: committedAmount(input),
      authority,
    });
    if (result.isErr()) throw result.error;
  }
}
