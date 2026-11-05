import {
  type ArtworkRegisterEntry,
  type OfferState,
  WITHDRAWN_FROM_LABEL,
  type WithdrawnFrom,
  deriveWhereItIs,
} from "@auction/artwork-register-contracts";
import type { AdminBidLotRef, AdminLaxArtListing, AdminWhereItIs } from "@auction/shop-contracts";
import type { RegisterEventRecord } from "../ports/artwork-register-review.ports.js";

type Move = { at: Date; from: OfferState | null; to: OfferState };

function stateOf(value: unknown): OfferState | null {
  const state = value && typeof value === "object" ? (value as { state?: unknown }).state : null;
  return typeof state === "string" ? (state as OfferState) : null;
}

/** The offer moves in the history, oldest first. */
function movesOf(events: readonly RegisterEventRecord[]): Move[] {
  return events
    .filter((event) => event.type === "offer_moved")
    .flatMap((event) => {
      const to = stateOf(event.payload.to);
      return to ? [{ at: event.createdAt, from: stateOf(event.payload.from), to }] : [];
    });
}

const WITHDRAWN_SOURCES: readonly OfferState[] = ["lax_art", "bid_sale", "private_sale"];

function withdrawnFrom(state: OfferState | null): WithdrawnFrom | null {
  return state && WITHDRAWN_SOURCES.includes(state) ? (state as WithdrawnFrom) : null;
}

function lastInto(moves: readonly Move[], state: OfferState): Move | undefined {
  return [...moves].reverse().find((move) => move.to === state);
}

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
  const moves = movesOf(events);
  const into = lastInto(moves, entry.offer.state);
  const withdrawn = into && entry.offer.state === "withdrawn" ? into : null;
  const place = deriveWhereItIs({
    offer: entry.offer,
    now,
    withdrawn: withdrawn ? { at: withdrawn.at, from: withdrawnFrom(withdrawn.from) } : null,
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
  const since = place.key === "lax_art" ? lastInto(moves, "lax_art")?.at : undefined;
  return { key, chip, from: null, since: since?.toISOString() ?? null, bidLot };
}
