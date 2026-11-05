import type { ArtworkRegisterEntry } from "./entry.js";
import { type LockMessage, type LockReason, lockMessage } from "./lock-messages.js";
import { offerRefusal, offerRefusalReason } from "./offer-lock.js";
import type { OfferState } from "./offer-state.js";
import { isReservedInZoho, isSoldInZoho } from "./sold-in-gallery.js";

/**
 * What lax.art holds about the artwork when a lax.art listing is linked to its register record. A
 * record with no listing passes `null`: offering it at auction then never touches lax.art.
 */
export type AuctionOfferListing = {
  /** Published and not archived: buyers can see it on lax.art now. */
  live: boolean;
  /** The listing is marked sold in the Shop catalogue. */
  markedSold: boolean;
  /** A buyer holds a reservation, deposit, invoice or payment on this original. */
  openOriginalSale: boolean;
};

const PLACE_REASON: Partial<Record<OfferState, LockReason>> = {
  private_sale: "in_private_sale",
  bid_sale: "in_bid_sale",
};

/**
 * Why an original cannot be offered at auction now, most important first, each in the words and
 * with the link of the lock. Empty means it can go. An original that is held, withdrawn or live on
 * lax.art through a linked listing may be offered (the listing is taken down as part of the move);
 * anything else is refused. Zoho's Reserved is listed beside the place that holds the artwork,
 * because staff need both to act. Prints are sold in runs and never take this path.
 */
export function auctionOfferBlockers(
  entry: Pick<ArtworkRegisterEntry, "kind" | "offer" | "catalogueStatus">,
  listing: AuctionOfferListing | null,
): LockMessage[] {
  if (entry.kind !== "original") return [lockMessage("print")];
  const { state } = entry.offer;
  const reasons: LockMessage[] = [];
  const add = (message: LockMessage) => {
    if (!reasons.some((existing) => existing.reason === message.reason)) reasons.push(message);
  };

  if (state === "sold") add(offerRefusal(offerRefusalReason(entry.offer), state));
  else if (listing?.markedSold) add(lockMessage("sold_through_lax"));
  else if (isSoldInZoho(entry.catalogueStatus)) add(lockMessage("sold_in_gallery"));

  if (listing?.openOriginalSale) add(lockMessage("buyer_holds"));

  const place = PLACE_REASON[state];
  if (place) add(lockMessage(place));
  // Live on lax.art with no linked listing to take down: staff must act on lax.art first.
  if (state === "lax_art" && !listing?.live) add(lockMessage("live_on_lax_art"));

  if (isReservedInZoho(entry.catalogueStatus)) add(lockMessage("reserved_in_zoho"));
  return reasons;
}
