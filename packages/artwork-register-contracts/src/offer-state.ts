/**
 * Where an artwork is offered. One place at a time: an artwork is on lax.art, in a Bid sale, in a
 * private sale, or off the market. A move from one place to another goes through `withdrawn`, so
 * the old offer is closed before the new one opens and the piece cannot be bought twice.
 */

export const OFFER_STATES = [
  "held",
  "lax_art",
  "bid_sale",
  "private_sale",
  "sold",
  "withdrawn",
] as const;
export type OfferState = (typeof OFFER_STATES)[number];

/** What the offer points at in the product that holds it. */
export const OFFER_REF_KINDS = ["shop_artwork", "bid_lot", "private_sale"] as const;
export type OfferRefKind = (typeof OFFER_REF_KINDS)[number];

export type OfferRef = { kind: OfferRefKind; id: string };

/** The reference each place needs; the other states carry none (a sale may keep the one it closed). */
export const OFFER_STATE_REF_KIND: Partial<Record<OfferState, OfferRefKind>> = {
  lax_art: "shop_artwork",
  bid_sale: "bid_lot",
  private_sale: "private_sale",
};

/** held is the neutral state; sold is terminal. */
export const OFFER_TRANSITIONS: Record<OfferState, readonly OfferState[]> = {
  held: ["lax_art", "bid_sale", "private_sale", "withdrawn"],
  lax_art: ["held", "sold", "withdrawn"],
  bid_sale: ["held", "sold", "withdrawn"],
  private_sale: ["held", "sold", "withdrawn"],
  withdrawn: ["held", "lax_art", "bid_sale", "private_sale"],
  sold: [],
};

export type OfferTransitionRefusal =
  | "same_state"
  | "sold_is_terminal"
  | "not_allowed"
  | "reference_required"
  | "reference_not_allowed"
  | "reference_wrong_kind";

export type OfferTransitionResult =
  | { ok: true; state: OfferState; ref: OfferRef | null }
  | { ok: false; reason: OfferTransitionRefusal };

export function isOfferState(value: string): value is OfferState {
  return (OFFER_STATES as readonly string[]).includes(value);
}

/** The places an artwork can go next. */
export function nextOfferStates(from: OfferState): readonly OfferState[] {
  return OFFER_TRANSITIONS[from];
}

/**
 * Checks a move and returns the new state and reference. An offered state needs the reference of
 * its place; held and withdrawn drop it; sold may keep the reference of the sale that closed it.
 */
export function transitionOffer(
  from: OfferState,
  to: OfferState,
  ref: OfferRef | null,
): OfferTransitionResult {
  if (from === "sold") return { ok: false, reason: "sold_is_terminal" };
  if (from === to) return { ok: false, reason: "same_state" };
  if (!OFFER_TRANSITIONS[from].includes(to)) return { ok: false, reason: "not_allowed" };

  const required = OFFER_STATE_REF_KIND[to];
  if (required) {
    if (!ref) return { ok: false, reason: "reference_required" };
    if (ref.kind !== required) return { ok: false, reason: "reference_wrong_kind" };
    return { ok: true, state: to, ref };
  }
  if (to === "sold") return { ok: true, state: to, ref };
  if (ref) return { ok: false, reason: "reference_not_allowed" };
  return { ok: true, state: to, ref: null };
}
