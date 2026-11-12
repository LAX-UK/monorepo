import type { Database } from "@auction/db";
import type { SettlementFollowUpSeverity } from "@auction/domain";

/** Remembers which settled deals staff have already been told about, so each is raised once. */
export interface IDealSettlementFollowUpMarker {
  /**
   * Takes the deal's turn at this severity inside the caller's transaction: `true` the first time,
   * `false` when staff were already told at this severity or a higher one. A deal that was raised
   * as normal is raised once more if it becomes urgent. Concurrent callers queue, so only one wins.
   */
  claimInTransaction(
    tx: Database,
    dealId: string,
    severity: SettlementFollowUpSeverity,
  ): Promise<boolean>;
}
