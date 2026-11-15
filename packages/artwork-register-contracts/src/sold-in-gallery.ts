/**
 * Sales LAX does not make. The gallery sells at the till and Zoho is told by setting the
 * artwork's Status to Sold; LAX has to treat that as sold everywhere. These rules are pure: they
 * say what the register should record and when a person has to decide, and the callers do the work.
 *
 * A sale made in the gallery is recorded with an explicit reference (`gallery_sale`, naming the
 * Zoho product). A sale made through LAX keeps the reference of the place that closed it. A sold
 * row with no reference at all says nothing about where it was sold, and reads as plain Sold.
 */

import {
  GALLERY_SALE_REF_KIND,
  type OfferPlaceRefKind,
  type OfferRef,
  type OfferState,
} from "./offer-state.js";

export const ZOHO_STATUS_SOLD = "Sold";
export const ZOHO_STATUS_RESERVED = "Reserved";

function sameStatus(status: string | null | undefined, expected: string): boolean {
  return status?.trim().toLowerCase() === expected.toLowerCase();
}

export function isSoldInZoho(status: string | null | undefined): boolean {
  return sameStatus(status, ZOHO_STATUS_SOLD);
}

export function isReservedInZoho(status: string | null | undefined): boolean {
  return sameStatus(status, ZOHO_STATUS_RESERVED);
}

/** Where a sale was made; `unknown` is a sold row that records no place. */
export const SOLD_WHERE = ["lax_art", "bid_sale", "private_sale", "gallery", "unknown"] as const;
export type SoldWhere = (typeof SOLD_WHERE)[number];

const SOLD_WHERE_FOR_PLACE_KIND: Record<OfferPlaceRefKind, SoldWhere> = {
  shop_artwork: "lax_art",
  bid_lot: "bid_sale",
  private_sale: "private_sale",
};

type RegisterOffer = { state: OfferState; ref: OfferRef | null };

/** Where a sold artwork was sold; null when it is not sold. */
export function soldWhere(offer: RegisterOffer): SoldWhere | null {
  if (offer.state !== "sold") return null;
  if (!offer.ref) return "unknown";
  return offer.ref.kind === GALLERY_SALE_REF_KIND
    ? "gallery"
    : SOLD_WHERE_FOR_PLACE_KIND[offer.ref.kind];
}

export type GallerySaleResult =
  /** The register moves to sold, with the gallery sale as its reference. */
  | { ok: true; changed: true; from: OfferState; state: "sold"; ref: OfferRef }
  /** Already sold, whether through LAX (its own write-back to Zoho) or in the gallery. */
  | { ok: true; changed: false; state: "sold"; ref: OfferRef | null };

/**
 * Zoho says Sold. From any state the register moves to sold in the gallery, naming the Zoho
 * product that said so; an artwork the register already shows as sold is left as it is, so a
 * repeat or LAX's own write-back is a no-op.
 */
export function recordGallerySale(offer: RegisterOffer, zohoProductId: string): GallerySaleResult {
  if (offer.state === "sold") return { ok: true, changed: false, state: "sold", ref: offer.ref };
  const ref: OfferRef = { kind: GALLERY_SALE_REF_KIND, id: zohoProductId };
  return { ok: true, changed: true, from: offer.state, state: "sold", ref };
}

export const REOPEN_REASON_MAX_LENGTH = 500;

export type ReopenRefusal = "not_sold" | "reason_required" | "reason_too_long";

export type ReopenResult =
  | { ok: true; from: "sold"; state: "held"; ref: null; reason: string; wasSoldWhere: SoldWhere }
  | { ok: false; refusal: ReopenRefusal };

/**
 * An Administrator takes a sale back. The artwork returns to held (Not offered) and nothing is
 * offered again by itself. A reason is required and kept in the history. The result says where it
 * had been sold, so the caller can apply the stricter checks a sale made through LAX needs.
 */
export function reopenSold(offer: RegisterOffer, reason: string): ReopenResult {
  const where = soldWhere(offer);
  if (!where) return { ok: false, refusal: "not_sold" };
  const trimmed = reason.trim();
  if (trimmed === "") return { ok: false, refusal: "reason_required" };
  if (trimmed.length > REOPEN_REASON_MAX_LENGTH) return { ok: false, refusal: "reason_too_long" };
  return { ok: true, from: "sold", state: "held", ref: null, reason: trimmed, wasSoldWhere: where };
}

export type ZohoStatusReconciliation =
  | { action: "none" }
  /** Zoho shows Sold and the register does not: record the sale in the gallery. */
  | { action: "record_gallery_sale" }
  /** Zoho no longer shows a gallery sale as sold: a person decides whether to reopen it. */
  | { action: "needs_decision"; kind: "zoho_took_sold_back" };

/**
 * What a Zoho status means for the register. Zoho's Sold always wins. Sold only goes back to
 * not-sold by a person's decision, never by the sync. A sale made through LAX is LAX's own write
 * back to Zoho, so a different Zoho status there is a field conflict, not a reopened sale.
 */
export function reconcileZohoStatus(
  offer: RegisterOffer,
  zohoStatus: string | null | undefined,
): ZohoStatusReconciliation {
  const zohoSold = isSoldInZoho(zohoStatus);
  if (zohoSold) {
    return offer.state === "sold" ? { action: "none" } : { action: "record_gallery_sale" };
  }
  const tookBack = soldWhere(offer) === "gallery" && Boolean(zohoStatus?.trim());
  return tookBack ? { action: "needs_decision", kind: "zoho_took_sold_back" } : { action: "none" };
}

/**
 * Where a gallery sale cannot be recorded straight away. A Bid lot and a private sale belong to
 * the product that runs them: staff withdraw them there (the "Zoho says Sold, but this artwork is
 * still for sale" item tells them to), and the sale is recorded once they have.
 */
export type GallerySaleWait = "bid_sale" | "private_sale";

export type GallerySalePlan =
  | { action: "none" }
  /** Zoho says Sold and the artwork is not offered where LAX must ask first: record the sale. */
  | {
      action: "record";
      from: "held" | "withdrawn" | "lax_art";
      /** The lax.art listing to take off sale, when the artwork was on lax.art. */
      laxArtListingId: string | null;
    }
  /** Zoho says Sold while a Bid lot or private sale holds the artwork: staff withdraw it first. */
  | { action: "wait_for_staff"; place: GallerySaleWait };

/**
 * What a Zoho Sold means for one artwork. Zoho wins: an original Zoho shows as Sold is recorded as
 * sold in the gallery, unless a Bid lot or a private sale still holds it, which only staff can
 * close. Prints are sold in runs and are never governed. Already sold, however it was sold, is a
 * no-op, so a repeated notice or LAX's own write-back changes nothing.
 */
export function planGallerySale(entry: {
  kind: string;
  catalogueStatus: string | null;
  offer: RegisterOffer;
}): GallerySalePlan {
  if (entry.kind !== "original") return { action: "none" };
  if (reconcileZohoStatus(entry.offer, entry.catalogueStatus).action !== "record_gallery_sale") {
    return { action: "none" };
  }
  const { state, ref } = entry.offer;
  if (state === "bid_sale" || state === "private_sale") {
    return { action: "wait_for_staff", place: state };
  }
  if (state === "held" || state === "withdrawn" || state === "lax_art") {
    const laxArtListingId = state === "lax_art" && ref?.kind === "shop_artwork" ? ref.id : null;
    return { action: "record", from: state, laxArtListingId };
  }
  return { action: "none" };
}

/** Why Reopen is refused, beyond the reason checks in `reopenSold`. */
export type ReopenGallerySaleRefusal =
  | ReopenRefusal
  /** Sold through LAX (lax.art, a Bid lot or a private sale): money moved, so it is not undone here. */
  | "not_a_gallery_sale"
  /** Zoho still says Sold, and Zoho wins: the Status is changed in Zoho first. */
  | "zoho_still_sold";

export type ReopenGallerySaleResult =
  | Extract<ReopenResult, { ok: true }>
  | { ok: false; refusal: ReopenGallerySaleRefusal };

/**
 * An Administrator undoes a gallery sale recorded by mistake. Only a gallery sale can be reopened
 * this way, and only once Zoho no longer says Sold: otherwise the next sync would record it again,
 * and Zoho is the source of truth. The artwork returns to held; nothing is offered by itself.
 */
export function reopenGallerySale(
  entry: { catalogueStatus: string | null; offer: RegisterOffer },
  reason: string,
): ReopenGallerySaleResult {
  const reopened = reopenSold(entry.offer, reason);
  if (!reopened.ok) return reopened;
  if (reopened.wasSoldWhere !== "gallery") return { ok: false, refusal: "not_a_gallery_sale" };
  if (isSoldInZoho(entry.catalogueStatus)) return { ok: false, refusal: "zoho_still_sold" };
  return reopened;
}

/** What staff read when Reopen is refused. The contract owns the words so every screen agrees. */
export const REOPEN_REFUSAL_MESSAGE: Record<ReopenGallerySaleRefusal, string> = {
  not_sold: "This artwork is not sold, so there is nothing to reopen.",
  reason_required:
    "Say why the sale is being reopened. The reason is kept in the artwork's history.",
  reason_too_long: `Keep the reason to ${REOPEN_REASON_MAX_LENGTH} characters or fewer.`,
  not_a_gallery_sale:
    "This artwork was sold through LAX, so it cannot be reopened here. Speak to finance.",
  zoho_still_sold:
    "Zoho still says Sold, and Zoho wins. Change the Status in Zoho first, then reopen it here.",
};
