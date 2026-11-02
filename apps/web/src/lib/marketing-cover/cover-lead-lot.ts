import { hangLotPhoto } from "@/lib/hang/hang-lot";
import { pickHangLots } from "@/lib/hang/hang-selection";
import type { Lot } from "@auction/types";

/**
 * The lot a cover leads with: the first of staff's featured lots that can be shown, otherwise the
 * top lot by current bid (live), opening bid (upcoming) or sold price (results). Only lots with a
 * photograph the public may see qualify; withdrawn lots never do.
 */
export function pickCoverLeadLot(
  lots: readonly Lot[],
  featuredLotIds: readonly string[] = [],
): Lot | null {
  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  for (const id of featuredLotIds) {
    const lot = byId.get(id);
    if (lot && hangLotPhoto(lot)) return lot;
  }
  return pickHangLots(lots, [], 1)[0] ?? null;
}
