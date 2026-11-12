import type { Database } from "@auction/db";

/** Remembers which settled deals staff have already been told about, so each is raised once. */
export interface IDealSettlementFollowUpMarker {
  /**
   * Takes the deal's turn inside the caller's transaction: `true` the first time, `false` when it
   * was already raised. Concurrent callers for one deal queue behind each other, so only one wins.
   */
  claimInTransaction(tx: Database, dealId: string): Promise<boolean>;
}
