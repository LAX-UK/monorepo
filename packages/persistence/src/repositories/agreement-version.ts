import { commissionPercentToBps } from "@auction/domain";

/**
 * Whether the agreement row a sale was priced on has changed since: its commission is no longer
 * the snapshot's rate, or it was written again (a corrected agreement recorded over it) after the
 * snapshot was made. The sale is still paid on the snapshot; staff are told it was priced on an
 * earlier version of the agreement the reference now opens.
 */
export function pricedOnEarlierVersion(
  snapshot: { commissionBps: number | null; computedAt: Date },
  live: { commissionPercent: string | null; updatedAt: Date },
): boolean {
  if (snapshot.commissionBps === null) return false;
  const liveBps = commissionPercentToBps(live.commissionPercent);
  return (
    liveBps !== snapshot.commissionBps || live.updatedAt.getTime() > snapshot.computedAt.getTime()
  );
}
