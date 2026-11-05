/**
 * The words staff read when an offer is refused. Each message names the place (and the sale and
 * lot when known), says the one thing to do, and carries the link that gets them there. The
 * contract owns the wording so LAX Admin, LAX Bid and the APIs all say the same thing.
 */

export const LOCK_REASONS = [
  "live_on_lax_art",
  "in_bid_sale",
  "in_private_sale",
  "sold_through_lax",
  "sold_in_gallery",
  "reserved_in_zoho",
  "buyer_holds",
  "not_linked",
  "print",
] as const;
export type LockReason = (typeof LOCK_REASONS)[number];

/** Where a link in a lock message goes; each product turns this into a URL it can open. */
export const LOCK_LINK_TARGETS = [
  "lax_art_listing",
  "bid_lot",
  "private_sale",
  "sold_place",
  "zoho_record",
  "open_sale",
  "link_to_zoho",
] as const;
export type LockLinkTarget = (typeof LOCK_LINK_TARGETS)[number];

export type LockMessage = {
  reason: LockReason;
  message: string;
  link: { label: string; target: LockLinkTarget } | null;
};

/** What the product knows about the sale holding the artwork; both parts are optional. */
export type OfferPlaceDetail = {
  saleName?: string | null;
  lotNumber?: string | number | null;
};

const LINKS: Record<LockReason, LockMessage["link"]> = {
  live_on_lax_art: { label: "Open on lax.art", target: "lax_art_listing" },
  in_bid_sale: { label: "Open lot in LAX Bid", target: "bid_lot" },
  in_private_sale: { label: "Open private sale", target: "private_sale" },
  sold_through_lax: { label: "Where it was sold", target: "sold_place" },
  sold_in_gallery: { label: "Edit in Zoho", target: "zoho_record" },
  reserved_in_zoho: { label: "Edit in Zoho", target: "zoho_record" },
  buyer_holds: { label: "Open the sale", target: "open_sale" },
  not_linked: { label: "Link to Zoho record…", target: "link_to_zoho" },
  print: null,
};

function bidSaleWhere(detail: OfferPlaceDetail | undefined): string {
  const parts: string[] = [];
  const sale = detail?.saleName?.trim();
  if (sale) parts.push(sale);
  const lot = detail?.lotNumber;
  if (lot !== undefined && lot !== null && String(lot).trim() !== "") parts.push(`lot ${lot}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

function textFor(reason: LockReason, detail: OfferPlaceDetail | undefined): string {
  switch (reason) {
    case "live_on_lax_art":
      return "This artwork is live on lax.art. Take it off lax.art first, or use Offer at auction to move it.";
    case "in_bid_sale":
      return `This artwork is in a LAX Bid sale${bidSaleWhere(detail)}. Withdraw the lot there first.`;
    case "in_private_sale":
      return "This artwork is in a private sale. Withdraw it there first.";
    case "sold_through_lax":
      return "This artwork has been sold, so it can't be offered again.";
    case "sold_in_gallery":
      return "Zoho shows this artwork as sold in the gallery, so it can't be offered.";
    case "reserved_in_zoho":
      return "Zoho shows this artwork as reserved. Offer it once Zoho shows it as available.";
    case "buyer_holds":
      return "A buyer has reserved this artwork, or an offer on it is open. Finish or cancel that sale first.";
    case "not_linked":
      return "Link this artwork to its Zoho record before publishing.";
    case "print":
      return "Prints are sold in runs on LAX Shop, not on lax.art or at auction.";
  }
}

export function lockMessage(reason: LockReason, detail?: OfferPlaceDetail): LockMessage {
  return { reason, message: textFor(reason, detail), link: LINKS[reason] };
}
