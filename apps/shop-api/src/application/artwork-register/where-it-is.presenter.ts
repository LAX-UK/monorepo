import {
  type ArtworkRegisterEntry,
  WITHDRAWN_FROM_LABEL,
  deriveWhereItIs,
  lastMoveInto,
  offerMovesOf,
  withdrawalOf,
} from "@auction/artwork-register-contracts";
import type { AdminBidLotRef, AdminLaxArtListing, AdminWhereItIs } from "@auction/shop-contracts";
import type { RegisterEventRecord } from "../ports/artwork-register-review.ports.js";

/** The lot a place is about: the draft lot, or the lot that holds the artwork in a sale. */
function bidLotOf(
  key: AdminWhereItIs["key"],
  ref: { kind: string; id: string } | null,
  bidDraft: AdminBidLotRef | null,
): AdminBidLotRef | null {
  if (key === "draft_bid_lot") return bidDraft;
  if (key === "bid_sale" && ref?.kind === "bid_lot") return { lotId: ref.id, saleTitle: null };
  return null;
}

/**
 * Where an original is, for the record page and the artwork page. The register records an offer
 * only at publish, so a draft comes from the linked lax.art listing; the withdrawn date and the
 * place it was withdrawn from come from the history.
 */
export function presentWhereItIs(input: {
  entry: Pick<ArtworkRegisterEntry, "offer">;
  events: readonly RegisterEventRecord[];
  laxArt: AdminLaxArtListing | null;
  /** The draft lot LAX Bid holds for the record, when it has one. */
  bidDraft?: AdminBidLotRef | null;
  now: Date;
}): AdminWhereItIs {
  const { entry, events, laxArt, bidDraft = null, now } = input;
  const moves = offerMovesOf(events);
  const into = lastMoveInto(moves, entry.offer.state);
  const withdrawn = withdrawalOf(moves, entry.offer.state);
  const place = deriveWhereItIs({
    offer: entry.offer,
    now,
    withdrawn,
    hasLaxArtDraft: laxArt !== null && !laxArt.published,
    hasBidDraftLot: bidDraft !== null,
  });
  const bidLot = bidLotOf(place.key, entry.offer.ref, bidDraft);
  const { key, chip } = place;
  if (place.key === "withdrawn") {
    return {
      key,
      chip,
      from: place.from ? WITHDRAWN_FROM_LABEL[place.from] : null,
      since: withdrawn?.at.toISOString() ?? null,
      bidLot,
    };
  }
  if (place.key === "sold") {
    return {
      key,
      chip,
      from: place.soldWhereLabel,
      since: into?.at.toISOString() ?? null,
      bidLot,
    };
  }
  const since = place.key === "lax_art" ? lastMoveInto(moves, "lax_art")?.at : undefined;
  return { key, chip, from: null, since: since?.toISOString() ?? null, bidLot };
}
