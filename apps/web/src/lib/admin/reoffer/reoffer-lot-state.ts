import { isOpenReofferStatus } from "@auction/domain";
import { type StatusPresentation, formatStaffMoney } from "@auction/staff-ui";
import type { StaffBuyerDefault, StaffReoffer } from "@auction/validators";
import type { LotReofferBundle } from "./reoffer-bundle";
import { REOFFER_META_LABEL } from "./reoffer-status";

type ReadyBundle = Extract<LotReofferBundle, { status: "ready" }>;

/** The lot as the re-offer screens need it. */
export type ReofferLotFacts = { status: string; hasWinner: boolean };

/**
 * Whether the lot page shows the Re-offer card. After a default the lot waits for a buyer, so
 * the card is there until an offer has made someone the buyer or staff returned the lot. Once any
 * offer exists the card stays, even after a re-award, as the record of what happened.
 */
export function showsReofferCard(
  bundle: ReadyBundle,
  lot: ReofferLotFacts,
): bundle is ReadyBundle & { buyerDefault: StaffBuyerDefault } {
  if (!bundle.buyerDefault) return false;
  if (bundle.offers.length > 0) return true;
  return lot.status === "ended" && !lot.hasWinner;
}

/** The offer someone is waiting on, if any: at most one exists per lot. */
export function openOffer(offers: readonly StaffReoffer[]): StaffReoffer | null {
  return offers.find((offer) => isOpenReofferStatus(offer.status)) ?? null;
}

export type ReofferHeader = {
  /** Replaces the lot's status badge while the lot waits for a buyer after a default. */
  badge: StatusPresentation | null;
  /** "waiting for the seller", the value of the header's Re-offer meta item. */
  meta: string | null;
};

/** What the lot's header says about the default and the offer, or nothing for any other lot. */
export function reofferHeader(bundle: LotReofferBundle, lot: ReofferLotFacts): ReofferHeader {
  if (bundle.status !== "ready" || !showsReofferCard(bundle, lot)) {
    return { badge: null, meta: null };
  }
  const waiting = lot.status === "ended" && !lot.hasWinner;
  const latest = bundle.offers.at(-1);
  return {
    badge: waiting ? { label: "Buyer default", tone: "danger" } : null,
    meta: latest ? REOFFER_META_LABEL[latest.status] : null,
  };
}

/** The Overview's price figure while an offer is open: the offer price, not the old hammer. */
export function offerPriceTile<T extends { id: string; label: string; value: string }>(
  tiles: readonly T[],
  offer: StaffReoffer | null,
): T[] {
  if (!offer) return [...tiles];
  return tiles.map((tile) =>
    tile.id === "current-bid"
      ? { ...tile, label: "Offer price", value: formatStaffMoney(offer.offerMinor) }
      : tile,
  );
}
