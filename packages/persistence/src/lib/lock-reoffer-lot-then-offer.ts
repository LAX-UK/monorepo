import type { Database } from "@auction/db";
import type { LotReofferView } from "../interfaces/lot-reoffer.js";
import type { IReofferWorkflowReader, ReofferLockedLot } from "../interfaces/reoffer-workflow.js";

export type LockedReoffer =
  | { ok: true; lot: ReofferLockedLot; offer: LotReofferView }
  | { ok: false; missing: "offer" | "lot" };

/**
 * Takes the lot's row lock, then the offer's: the one order every step takes, in the API and in
 * the clock sweeps (the re-award uses it too), so two steps on one lot queue instead of
 * deadlocking. Everything the step then reads, it reads under these locks, so a payment or a
 * second answer cannot slip in between check and write.
 */
export async function lockReofferLotThenOffer(
  tx: Database,
  workflow: IReofferWorkflowReader,
  reofferId: string,
): Promise<LockedReoffer> {
  const lotId = await workflow.lotIdOfOffer(tx, reofferId);
  if (!lotId) return { ok: false, missing: "offer" };
  const lot = await workflow.lockLot(tx, lotId);
  if (!lot || lot.deleted) return { ok: false, missing: "lot" };
  const offer = await workflow.lockOffer(tx, reofferId);
  if (!offer) return { ok: false, missing: "offer" };
  return { ok: true, lot, offer };
}
