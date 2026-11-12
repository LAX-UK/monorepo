import type { Database } from "@auction/db";
import type {
  IReofferWorkflowReader,
  LotReofferView,
  ReofferLockedLot,
} from "@auction/persistence/interfaces";
import { ReofferError } from "./reoffer-errors.js";

/**
 * Takes the lot's row lock, then the offer's: the one order every step uses (the re-award uses it
 * too), so two steps on one lot queue instead of deadlocking. Everything the step then reads, it
 * reads under this lock, and a payment or a second answer cannot slip in between check and write.
 */
export async function lockLotAndOffer(
  tx: Database,
  workflow: IReofferWorkflowReader,
  reofferId: string,
): Promise<{ lot: ReofferLockedLot; offer: LotReofferView }> {
  const lotId = await workflow.lotIdOfOffer(tx, reofferId);
  if (!lotId) throw new ReofferError("offer_not_found", "This offer does not exist.");
  const lot = await workflow.lockLot(tx, lotId);
  if (!lot || lot.deleted) throw new ReofferError("lot_not_found", "Lot not found.");
  const offer = await workflow.lockOffer(tx, reofferId);
  if (!offer) throw new ReofferError("offer_not_found", "This offer does not exist.");
  return { lot, offer };
}

/** The lot as the lifecycle recorder wants it. */
export function recordedLot(lot: ReofferLockedLot) {
  return {
    id: lot.id,
    saleId: lot.saleId,
    ...(lot.sellerLegalEntityId !== null ? { sellerLegalEntityId: lot.sellerLegalEntityId } : {}),
  };
}
