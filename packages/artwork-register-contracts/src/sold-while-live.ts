/**
 * Zoho says an artwork is Sold or Reserved while LAX still has it for sale. Zoho is the source of
 * truth, but LAX does not withdraw the artwork by itself: staff see a "Needs attention" item and
 * decide, and until they do, new money for that artwork is paused. These rules are pure. They say
 * when the situation exists, what the item says, and what has to happen to the item next; the
 * callers read and write.
 */

import type { ArtworkRegisterEntry } from "./entry.js";
import type { OfferState } from "./offer-state.js";
import { isReservedInZoho, isSoldInZoho } from "./sold-in-gallery.js";

export const SOLD_WHILE_LIVE_STATUSES = ["Sold", "Reserved"] as const;
export type SoldWhileLiveStatus = (typeof SOLD_WHILE_LIVE_STATUSES)[number];

/**
 * Where the artwork is still for sale. `bid_reoffer` is a lot offered to the next bidder after its
 * sale ended; the register records it against the lot, so the caller says which it is.
 */
export const SOLD_WHILE_LIVE_PLACES = [
  "lax_art",
  "bid_sale",
  "bid_reoffer",
  "private_sale",
] as const;
export type SoldWhileLivePlace = (typeof SOLD_WHILE_LIVE_PLACES)[number];

export type SoldWhileLiveSituation = { status: SoldWhileLiveStatus; place: SoldWhileLivePlace };

const PLACE_FOR_STATE: Partial<Record<OfferState, "lax_art" | "bid_sale" | "private_sale">> = {
  lax_art: "lax_art",
  bid_sale: "bid_sale",
  private_sale: "private_sale",
};

export function soldWhileLiveStatusOf(
  zohoStatus: string | null | undefined,
): SoldWhileLiveStatus | null {
  if (isSoldInZoho(zohoStatus)) return "Sold";
  if (isReservedInZoho(zohoStatus)) return "Reserved";
  return null;
}

/**
 * The situation an original is in, or null when there is none: its Zoho status is not Sold or
 * Reserved, or it is not for sale anywhere. Prints are sold in runs and are never governed.
 */
export function assessSoldWhileLive(
  entry: Pick<ArtworkRegisterEntry, "kind" | "catalogueStatus" | "offer">,
  options: { reoffer?: boolean } = {},
): SoldWhileLiveSituation | null {
  if (entry.kind !== "original") return null;
  const status = soldWhileLiveStatusOf(entry.catalogueStatus);
  const place = PLACE_FOR_STATE[entry.offer.state];
  if (!status || !place) return null;
  // LAX writes Reserved to Zoho for a private sale itself, so Reserved there is LAX's own value and
  // says nothing. Only Sold, which LAX never writes for a private sale, is a situation.
  if (place === "private_sale" && status === "Reserved") return null;
  return { status, place: place === "bid_sale" && options.reoffer ? "bid_reoffer" : place };
}

export const SOLD_WHILE_LIVE_ACTIONS = [
  "unpublish_lax_art",
  "withdraw_lot",
  "withdraw_offer",
  "open_in_zoho",
  "not_sold",
] as const;
export type SoldWhileLiveActionKind = (typeof SOLD_WHILE_LIVE_ACTIONS)[number];

export const SOLD_WHILE_LIVE_ACTION_LABELS: Record<SoldWhileLiveActionKind, string> = {
  unpublish_lax_art: "Unpublish from lax.art",
  withdraw_lot: "Withdraw the lot",
  withdraw_offer: "Withdraw the offer",
  open_in_zoho: "Open in Zoho",
  not_sold: "It is not sold",
};

const WITHDRAW_ACTION_FOR_PLACE: Record<SoldWhileLivePlace, SoldWhileLiveActionKind> = {
  lax_art: "unpublish_lax_art",
  bid_sale: "withdraw_lot",
  bid_reoffer: "withdraw_offer",
  // A private sale is withdrawn from its own page, which the same wording covers.
  private_sale: "withdraw_offer",
};

export const SOLD_WHILE_LIVE_EMPTY_STATE = "Nothing needs attention. Zoho and LAX agree.";

export const OVERRIDE_REASON_MAX_LENGTH = 500;

export type SoldWhileLiveCopyInput = {
  status: SoldWhileLiveStatus;
  place: SoldWhileLivePlace;
  title: string;
  stockCode: string;
  /** The day Zoho marked it, already written in the one date style the product uses. */
  markedOn: string;
  /** The lot number, where the place is a Bid lot and it is known. */
  lotNumber?: number | null;
};

export type SoldWhileLiveCopy = {
  tone: "danger";
  title: string;
  body: string;
  /** In the order they are shown: the way out for this place, then Zoho, then the override. */
  actions: { kind: SoldWhileLiveActionKind; label: string }[];
};

function stillWhere(place: SoldWhileLivePlace, lotNumber: number | null | undefined): string {
  const lot = lotNumber == null ? "" : `, lot ${lotNumber}`;
  switch (place) {
    case "lax_art":
      return "on lax.art";
    case "bid_sale":
      return `in a LAX Bid sale${lot}`;
    case "bid_reoffer":
      return `offered to the next bidder for LAX Bid lot${lotNumber == null ? "" : ` ${lotNumber}`}`;
    case "private_sale":
      return "in a private sale";
  }
}

/** The words staff read. The contract owns them so every screen says the same thing. */
export function soldWhileLiveCopy(input: SoldWhileLiveCopyInput): SoldWhileLiveCopy {
  const kinds: SoldWhileLiveActionKind[] = [
    WITHDRAW_ACTION_FOR_PLACE[input.place],
    "open_in_zoho",
    "not_sold",
  ];
  return {
    tone: "danger",
    title: `Zoho says ${input.status}, but this artwork is still for sale`,
    body: `${input.title} (${input.stockCode}) was marked ${input.status} in Zoho on ${input.markedOn}. It is still ${stillWhere(input.place, input.lotNumber)}. New payments and acceptances are paused until you decide.`,
    actions: kinds.map((kind) => ({ kind, label: SOLD_WHILE_LIVE_ACTION_LABELS[kind] })),
  };
}

/** What an item that is open (or kept by an override) needs next, given what is true now. */
export type SoldWhileLiveItemView = {
  status: SoldWhileLiveStatus;
  /** `open` pauses new money; `overridden` is staff saying it is not sold, kept until it clears. */
  state: "open" | "overridden";
};

/** `sold_in_lax`: the artwork has since sold on LAX, so it is no longer for sale anywhere. */
export type SoldWhileLiveResolution = "zoho_status_changed" | "withdrawn" | "sold_in_lax";

export type SoldWhileLiveDecision =
  | { action: "none" }
  | { action: "raise"; situation: SoldWhileLiveSituation }
  /** The situation is over. Say why, so the history can. */
  | { action: "resolve"; resolution: SoldWhileLiveResolution }
  /** The Zoho status moved between Sold and Reserved: close the old item, raise the new one. */
  | { action: "replace"; situation: SoldWhileLiveSituation };

/**
 * What to do with one artwork's item. One item per artwork and Zoho status, so a repeat does
 * nothing, and an item staff overrode stays quiet until the situation ends and a later one starts.
 * `situation` is what `assessSoldWhileLive` says now; `statusNow` is Zoho's status, to tell a
 * status that changed from a listing that was withdrawn.
 */
export function decideSoldWhileLive(input: {
  item: SoldWhileLiveItemView | null;
  situation: SoldWhileLiveSituation | null;
  statusNow: string | null | undefined;
  /** The register's offer state now, to tell an artwork that sold on LAX from one withdrawn. */
  offerState?: OfferState;
}): SoldWhileLiveDecision {
  const { item, situation } = input;
  if (!item) return situation ? { action: "raise", situation } : { action: "none" };
  if (!situation) {
    if (!soldWhileLiveStatusOf(input.statusNow)) {
      return { action: "resolve", resolution: "zoho_status_changed" };
    }
    return {
      action: "resolve",
      resolution: input.offerState === "sold" ? "sold_in_lax" : "withdrawn",
    };
  }
  return item.status === situation.status ? { action: "none" } : { action: "replace", situation };
}

export type OverrideRefusal = "reason_required" | "reason_too_long";

export type OverrideResult = { ok: true; reason: string } | { ok: false; refusal: OverrideRefusal };

/** "It is not sold" needs a reason, which is kept in the record's history. */
export function checkOverrideReason(reason: string): OverrideResult {
  const trimmed = reason.trim();
  if (trimmed === "") return { ok: false, refusal: "reason_required" };
  if (trimmed.length > OVERRIDE_REASON_MAX_LENGTH) return { ok: false, refusal: "reason_too_long" };
  return { ok: true, reason: trimmed };
}
