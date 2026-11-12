import type { Database } from "@auction/db";
import type {
  IReofferWorkflowReader,
  LotReofferView,
  ReofferLockedLot,
} from "@auction/persistence/interfaces";
import { lockReofferLotThenOffer } from "@auction/persistence/lib";
import { ReofferError } from "./reoffer-errors.js";

/**
 * Takes the lot's row lock, then the offer's, in the one order every step uses (see
 * `lockReofferLotThenOffer`), and says plainly when either is missing.
 */
export async function lockLotAndOffer(
  tx: Database,
  workflow: IReofferWorkflowReader,
  reofferId: string,
): Promise<{ lot: ReofferLockedLot; offer: LotReofferView }> {
  const locked = await lockReofferLotThenOffer(tx, workflow, reofferId);
  if (!locked.ok) {
    throw locked.missing === "lot"
      ? new ReofferError("lot_not_found", "Lot not found.")
      : new ReofferError("offer_not_found", "This offer does not exist.");
  }
  return { lot: locked.lot, offer: locked.offer };
}

/** The lot as the lifecycle recorder wants it. */
export function recordedLot(lot: ReofferLockedLot) {
  return {
    id: lot.id,
    saleId: lot.saleId,
    ...(lot.sellerLegalEntityId !== null ? { sellerLegalEntityId: lot.sellerLegalEntityId } : {}),
  };
}
