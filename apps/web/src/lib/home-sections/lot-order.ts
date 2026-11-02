import { lotWasSold } from "@/lib/lot/lot-outcome";
import type { Lot } from "@auction/types";

function lotNumberOf(lot: Lot): number {
  return lot.lotNumber ?? Number.MAX_SAFE_INTEGER;
}

/** Photographs first, so a card row is not led by a blank mat. The sort is stable. */
export function photographedFirst(lots: readonly Lot[]): Lot[] {
  return [...lots].sort((a, b) => Number(b.images.length > 0) - Number(a.images.length > 0));
}

/**
 * The lots of a sale that is live or opening, in the order a catalogue reads: the lots staff
 * featured first (when there are enough to mean something), then by lot number.
 */
export function catalogueOrder(lots: readonly Lot[], featuredLotIds: readonly string[]): Lot[] {
  const byNumber = [...lots].sort((a, b) => lotNumberOf(a) - lotNumberOf(b));
  const featured = featuredLotIds.flatMap((id) => byNumber.find((lot) => lot.id === id) ?? []);
  const rest = byNumber.filter((lot) => !featured.includes(lot));
  return [...featured, ...photographedFirst(rest)];
}

function hammer(lot: Lot): number {
  const price = Number.parseFloat(lot.currentPrice);
  return Number.isFinite(price) ? price : 0;
}

/** Sold lots, highest price first. Unsold and withdrawn lots are never shown as results. */
export function soldOrder(lots: readonly Lot[]): Lot[] {
  const sold = lots.filter((lot) => lot.status === "ended" && lotWasSold(lot));
  return photographedFirst([...sold].sort((a, b) => hammer(b) - hammer(a)));
}
