import { hangLotPhoto } from "@/lib/hang/hang-lot";
import { lotWasSold } from "@/lib/lot/lot-outcome";
import { HANG_MAX_WORKS } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";

/** Staff's featured lots lead only when there are at least this many; one lot is not a wall. */
const MIN_FEATURED = 2;

function standing(lot: Lot): number {
  const current = Number.parseFloat(lot.currentPrice);
  const starting = Number.parseFloat(lot.startingPrice);
  const price = Number.isFinite(current) && current > 0 ? current : starting;
  return Number.isFinite(price) ? price : 0;
}

/** Sold lots rank by what they made; unsold ones go last. */
function rank(lot: Lot): number {
  if (lot.status === "ended" && !lotWasSold(lot)) return -1;
  return standing(lot);
}

/**
 * Which lots hang: only lots with a photograph that the public may see. Staff's featured lots
 * lead in the order staff set (up to twelve); with fewer than two, the top lots by current bid,
 * opening bid or sold price.
 */
export function pickHangLots(
  lots: readonly Lot[],
  featuredLotIds: readonly string[] = [],
  limit: number = HANG_MAX_WORKS,
): Lot[] {
  const eligible = lots.filter((lot) => hangLotPhoto(lot) !== null);
  const byId = new Map(eligible.map((lot) => [lot.id, lot]));
  const featured = featuredLotIds
    .map((id) => byId.get(id))
    .filter((lot): lot is Lot => lot !== undefined);
  if (featured.length >= MIN_FEATURED) return featured.slice(0, limit);
  return [...eligible].sort((a, b) => rank(b) - rank(a)).slice(0, limit);
}
