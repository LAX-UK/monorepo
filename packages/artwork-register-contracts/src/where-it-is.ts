/**
 * "Where it is": the one vocabulary every product uses to say where an original stands. The
 * register records an offer only when it is published (see `offer-state.ts`), so the two draft
 * places come from the linked draft the caller supplies, not from the register state.
 *
 * Each place carries the chip it is drawn with. A hollow marker means buyers cannot see it yet; a
 * filled marker means they can. Sold uses a check and Withdrawn the warning tone, and the label
 * always says the place, so tone and shape are never the only cue.
 */

import type { OfferRef, OfferState } from "./offer-state.js";
import { type SoldWhere, soldWhere } from "./sold-in-gallery.js";

export const WHERE_IT_IS_KEYS = [
  "not_offered",
  "draft_lax_art",
  "lax_art",
  "draft_bid_lot",
  "bid_sale",
  "private_sale",
  "withdrawn",
  "sold",
] as const;
export type WhereItIsKey = (typeof WHERE_IT_IS_KEYS)[number];

export type WhereItIsTone = "neutral" | "info" | "success" | "warning";
export type WhereItIsMarker = "hollow" | "filled" | "check";

export type WhereItIsChip = {
  label: string;
  tone: WhereItIsTone;
  marker: WhereItIsMarker;
};

export const WHERE_IT_IS_CHIPS: Record<WhereItIsKey, WhereItIsChip> = {
  not_offered: { label: "Not offered", tone: "neutral", marker: "hollow" },
  draft_lax_art: { label: "Draft on lax.art", tone: "info", marker: "hollow" },
  lax_art: { label: "On lax.art", tone: "success", marker: "filled" },
  draft_bid_lot: { label: "Draft lot in LAX Bid", tone: "info", marker: "hollow" },
  bid_sale: { label: "In a LAX Bid sale", tone: "info", marker: "filled" },
  private_sale: { label: "In a private sale", tone: "info", marker: "filled" },
  withdrawn: { label: "Withdrawn", tone: "warning", marker: "filled" },
  sold: { label: "Sold", tone: "neutral", marker: "check" },
};

/** The places an offer can be withdrawn from. */
export type WithdrawnFrom = "lax_art" | "bid_sale" | "private_sale";

/** How a withdrawn place reads after "Withdrawn from". */
export const WITHDRAWN_FROM_LABEL: Record<WithdrawnFrom, string> = {
  lax_art: "lax.art",
  bid_sale: "LAX Bid",
  private_sale: "a private sale",
};

/** Where a sale was made, as it reads after "Sold". */
export const SOLD_WHERE_LABEL: Record<SoldWhere, string | null> = {
  lax_art: "On lax.art",
  bid_sale: "In LAX Bid",
  private_sale: "In a private sale",
  gallery: "In the gallery, per Zoho",
  unknown: null,
};

/** Withdrawn shows for this long after the artwork leaves a place, then it reads Not offered. */
export const WITHDRAWN_DISPLAY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WhereItIsInput = {
  offer: { state: OfferState; ref: OfferRef | null };
  now: Date;
  /** When and from where the offer was withdrawn, from the register's history. */
  withdrawn?: { at: Date; from: WithdrawnFrom | null } | null;
  /** A lax.art listing linked to the record that buyers cannot see yet. */
  hasLaxArtDraft?: boolean;
  /** A lot in a LAX Bid sale that has not started, linked to the record. */
  hasBidDraftLot?: boolean;
};

type Placed<K extends WhereItIsKey, Extra = object> = {
  key: K;
  chip: WhereItIsChip;
} & Extra;

export type WhereItIs =
  | Placed<Exclude<WhereItIsKey, "withdrawn" | "sold">>
  | Placed<"withdrawn", { from: WithdrawnFrom | null; showUntil: Date | null }>
  | Placed<"sold", { soldWhere: SoldWhere; soldWhereLabel: string | null }>;

function placed<K extends Exclude<WhereItIsKey, "withdrawn" | "sold">>(key: K): Placed<K> {
  return { key, chip: WHERE_IT_IS_CHIPS[key] };
}

/** A held artwork reads from its linked drafts. A lot draft is further along than a listing draft. */
function heldPlace(input: WhereItIsInput): WhereItIs {
  if (input.hasBidDraftLot) return placed("draft_bid_lot");
  if (input.hasLaxArtDraft) return placed("draft_lax_art");
  return placed("not_offered");
}

/**
 * Where an original is, from the register's offer, its linked drafts and the time. Pure: the same
 * input always gives the same answer, so every page that draws it agrees.
 */
export function deriveWhereItIs(input: WhereItIsInput): WhereItIs {
  const { offer } = input;
  switch (offer.state) {
    case "lax_art":
      return placed("lax_art");
    case "bid_sale":
      return placed("bid_sale");
    case "private_sale":
      return placed("private_sale");
    case "sold": {
      const where = soldWhere(offer) ?? "unknown";
      return {
        key: "sold",
        chip: WHERE_IT_IS_CHIPS.sold,
        soldWhere: where,
        soldWhereLabel: SOLD_WHERE_LABEL[where],
      };
    }
    case "withdrawn":
      return withdrawnPlace(input);
    case "held":
      return heldPlace(input);
  }
}

/**
 * Withdrawn stays for 30 days after the artwork leaves a place, then it reads as if held. With no
 * record of when, it stays Withdrawn: it is better to say too much than to hide a closed offer.
 */
function withdrawnPlace(input: WhereItIsInput): WhereItIs {
  const { withdrawn, now } = input;
  const showUntil = withdrawn
    ? new Date(withdrawn.at.getTime() + WITHDRAWN_DISPLAY_DAYS * DAY_MS)
    : null;
  if (showUntil && now.getTime() >= showUntil.getTime()) return heldPlace(input);
  return {
    key: "withdrawn",
    chip: WHERE_IT_IS_CHIPS.withdrawn,
    from: withdrawn?.from ?? null,
    showUntil,
  };
}

/** The part of a register history entry the offer moves are read from. */
export type OfferHistoryEvent = {
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

/** One move of the offer, as the history records it. */
export type OfferMove = { at: Date; from: OfferState | null; to: OfferState };

function stateOf(value: unknown): OfferState | null {
  const state = value && typeof value === "object" ? (value as { state?: unknown }).state : null;
  return typeof state === "string" ? (state as OfferState) : null;
}

/** The offer moves in the history, in the order the history is given (oldest first). */
export function offerMovesOf(events: readonly OfferHistoryEvent[]): OfferMove[] {
  return events
    .filter((event) => event.type === "offer_moved")
    .flatMap((event) => {
      const to = stateOf(event.payload.to);
      return to ? [{ at: event.createdAt, from: stateOf(event.payload.from), to }] : [];
    });
}

/** The latest move into a state, or `undefined` when the history has none. */
export function lastMoveInto(
  moves: readonly OfferMove[],
  state: OfferState,
): OfferMove | undefined {
  return [...moves].reverse().find((move) => move.to === state);
}

const WITHDRAWN_SOURCES: readonly OfferState[] = ["lax_art", "bid_sale", "private_sale"];

/**
 * When and from where an artwork now Withdrawn was withdrawn, from its history; `null` for any
 * other state, or when the history does not say.
 */
export function withdrawalOf(
  moves: readonly OfferMove[],
  state: OfferState,
): NonNullable<WhereItIsInput["withdrawn"]> | null {
  const into = state === "withdrawn" ? lastMoveInto(moves, "withdrawn") : undefined;
  if (!into) return null;
  const from =
    into.from && WITHDRAWN_SOURCES.includes(into.from) ? (into.from as WithdrawnFrom) : null;
  return { at: into.at, from };
}
