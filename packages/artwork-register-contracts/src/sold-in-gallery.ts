/**
 * Sales LAX does not make. The gallery sells at the till and Zoho is told by setting the
 * artwork's Status to Sold; LAX has to treat that as sold everywhere. These rules are pure: they
 * say what the register should record and when a person has to decide, and the callers do the work.
 *
 * A sold artwork with no sale reference was sold in the gallery. A sale made through LAX always
 * keeps the reference of the place that closed it (see `ArtworkOfferLock.markSold`).
 */

import type { OfferRef, OfferRefKind, OfferState } from "./offer-state.js";

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

export const SOLD_WHERE = ["lax_art", "bid_sale", "private_sale", "gallery"] as const;
export type SoldWhere = (typeof SOLD_WHERE)[number];

const SOLD_WHERE_FOR_REF_KIND: Record<OfferRefKind, SoldWhere> = {
  shop_artwork: "lax_art",
  bid_lot: "bid_sale",
  private_sale: "private_sale",
};

type RegisterOffer = { state: OfferState; ref: OfferRef | null };

/** Where a sold artwork was sold; null when it is not sold. */
export function soldWhere(offer: RegisterOffer): SoldWhere | null {
  if (offer.state !== "sold") return null;
  return offer.ref ? SOLD_WHERE_FOR_REF_KIND[offer.ref.kind] : "gallery";
}

export type GallerySaleResult =
  /** The register moves to sold with no sale reference. */
  | { ok: true; changed: true; from: OfferState; state: "sold"; ref: null }
  /** Already sold, whether through LAX (its own write-back to Zoho) or in the gallery. */
  | { ok: true; changed: false; state: "sold"; ref: OfferRef | null };

/**
 * Zoho says Sold. From any state the register moves to sold in the gallery; an artwork the
 * register already shows as sold is left as it is, so a repeat or LAX's own write-back is a no-op.
 */
export function recordGallerySale(offer: RegisterOffer): GallerySaleResult {
  if (offer.state === "sold") return { ok: true, changed: false, state: "sold", ref: offer.ref };
  return { ok: true, changed: true, from: offer.state, state: "sold", ref: null };
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
