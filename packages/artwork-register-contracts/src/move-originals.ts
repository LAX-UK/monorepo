import { z } from "zod";
import type { OfferState } from "./offer-state.js";

/**
 * Moving an original between lax.art and LAX Bid. LAX Admin starts a move to auction and LAX Bid
 * starts a return to lax.art; each product does its own half and asks the other over the machine
 * routes below. This module holds what both sides agree on: the routes, the request and answer
 * shapes, and the rules that say whether a move may go ahead.
 */

/** Both products mount their machine routes under this prefix. */
export const INVENTORY_INTERNAL_PREFIX = "/internal/inventory";

/** LAX Bid: sales an original can be offered in. */
export const AUCTION_SALES_SUBROUTE = "/auction-sales";
/** LAX Bid: create the draft lot for an original. */
export const DRAFT_LOT_SUBROUTE = "/draft-lots";
/** LAX Shop: reopen an original's lax.art listing as a draft. */
export const ART_LISTING_REOPEN_SUBROUTE = "/art-listings/reopen";

/** Both products hold the same pair; either side answers 503 until it is set. */
export const INVENTORY_MACHINE_HEADERS = {
  clientId: "x-inventory-client-id",
  clientSecret: "x-inventory-client-secret",
} as const;

/** A person's name as the register history records it: `staff:<user id>`. */
export const staffActorSchema = z.string().regex(/^staff:.+$/);

export const auctionSaleOptionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  startsAt: z.string(),
});
export type AuctionSaleOption = z.infer<typeof auctionSaleOptionSchema>;

export const auctionSalesAnswerSchema = z.object({ sales: z.array(auctionSaleOptionSchema) });
export type AuctionSalesAnswer = z.infer<typeof auctionSalesAnswerSchema>;

/** The catalogue facts a draft lot starts from. Staff finish the rest in LAX Bid. */
export const draftLotContentSchema = z.object({
  title: z.string().min(1).max(500),
  artistName: z.string().min(1).max(300),
  medium: z.string().max(300).nullable(),
  dimensions: z.string().max(300).nullable(),
  year: z.number().int().nullable(),
  description: z.string().max(10_000).nullable(),
  provenance: z.string().max(5_000).nullable(),
  /** Public image addresses, first is the cover. */
  imageUrls: z.array(z.string().url()).max(20),
});
export type DraftLotContent = z.infer<typeof draftLotContentSchema>;

export const draftLotRequestSchema = z.object({
  registerId: z.string().uuid(),
  saleId: z.string().uuid(),
  /** Starting price in pounds, for example "250.00". */
  startingPrice: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/),
  actor: staffActorSchema,
  content: draftLotContentSchema,
});
export type DraftLotRequest = z.infer<typeof draftLotRequestSchema>;

export const draftLotAnswerSchema = z.object({
  lotId: z.string().uuid(),
  saleId: z.string().uuid(),
  /** False when the draft already existed (a retry). */
  created: z.boolean(),
});
export type DraftLotAnswer = z.infer<typeof draftLotAnswerSchema>;

export const reopenListingRequestSchema = z.object({
  registerId: z.string().uuid(),
  actor: staffActorSchema,
});
export type ReopenListingRequest = z.infer<typeof reopenListingRequestSchema>;

export const reopenListingAnswerSchema = z.object({
  artworkId: z.string().uuid(),
  /** False when the listing was already a draft. */
  reopened: z.boolean(),
});
export type ReopenListingAnswer = z.infer<typeof reopenListingAnswerSchema>;

/** Why one product refused the other's request. The message is written for staff. */
export const MOVE_REFUSAL_CODES = [
  "sale_not_found",
  "sale_not_open",
  "already_drafted",
  "no_listing",
  "register_not_found",
  "not_configured",
  "artwork_offered_elsewhere",
] as const;
export type MoveRefusalCode = (typeof MOVE_REFUSAL_CODES)[number];

export const moveRefusalSchema = z.object({
  error: z.enum(MOVE_REFUSAL_CODES),
  message: z.string(),
});
export type MoveRefusal = z.infer<typeof moveRefusalSchema>;

/** The other product could not be reached, or answered something unexpected. Safe to retry. */
export class InventoryPeerUnavailableError extends Error {
  readonly code = "inventory_peer_unavailable";
  constructor(detail: string) {
    super(`The other product could not be reached (${detail}). Try again in a moment.`);
    this.name = "InventoryPeerUnavailableError";
  }
}

/** The other product refused the request, with a reason staff can act on. */
export class InventoryPeerRefusedError extends Error {
  constructor(
    readonly refusal: MoveRefusal,
    readonly status: number,
  ) {
    super(refusal.message);
    this.name = "InventoryPeerRefusedError";
  }
}

/* ---------------------------------------------------------------------------------------------
 * Eligibility
 * ------------------------------------------------------------------------------------------- */

export const AUCTION_MOVE_BLOCKERS = [
  "not_original",
  "no_register_record",
  "sold",
  "buyer_reserved",
  "in_private_sale",
  "in_auction",
  "not_on_lax_art",
] as const;
export type AuctionMoveBlocker = (typeof AUCTION_MOVE_BLOCKERS)[number];

export const AUCTION_MOVE_BLOCKER_MESSAGES: Record<AuctionMoveBlocker, string> = {
  not_original: "Only originals can be offered at auction. Prints are sold in runs.",
  no_register_record:
    "This artwork is not in the artwork register yet, so it cannot be moved. Link it to its Zoho record first.",
  sold: "This artwork has been sold, so it cannot be offered again.",
  buyer_reserved:
    "A buyer has reserved this artwork, or an offer on it is open. Finish or cancel that sale first.",
  in_private_sale: "This artwork is in a private sale. Withdraw it there first.",
  in_auction: "This artwork is already in a LAX Bid sale. Withdraw the lot there first.",
  not_on_lax_art: "This artwork is not on lax.art right now, so there is nothing to move.",
};

export type AuctionMoveFacts = {
  /** The register entry's kind; null when the artwork has no register record. */
  kind: "original" | "print" | null;
  offerState: OfferState | null;
  /** A buyer holds a reservation, deposit, invoice or payment on this original. */
  openOriginalSale: boolean;
  /** The artwork is marked sold in the Shop catalogue. */
  markedSold: boolean;
};

/**
 * What stops an original from moving to a LAX Bid sale, most important first. Empty means it can
 * go. An original that is on lax.art, held, or already withdrawn may move: staff may start from a
 * piece that is not listed anywhere.
 */
export function auctionMoveBlockers(facts: AuctionMoveFacts): AuctionMoveBlocker[] {
  if (facts.kind === null || facts.offerState === null) return ["no_register_record"];
  if (facts.kind !== "original") return ["not_original"];
  const blockers: AuctionMoveBlocker[] = [];
  if (facts.offerState === "sold" || facts.markedSold) blockers.push("sold");
  if (facts.openOriginalSale) blockers.push("buyer_reserved");
  if (facts.offerState === "private_sale") blockers.push("in_private_sale");
  if (facts.offerState === "bid_sale") blockers.push("in_auction");
  return blockers;
}

export const RETURN_MOVE_BLOCKERS = [
  "no_register_record",
  "still_in_sale",
  "not_offered",
  "has_winner",
  "elsewhere",
] as const;
export type ReturnMoveBlocker = (typeof RETURN_MOVE_BLOCKERS)[number];

export const RETURN_MOVE_BLOCKER_MESSAGES: Record<ReturnMoveBlocker, string> = {
  no_register_record: "This lot is not linked to an artwork in the register, so it cannot move.",
  still_in_sale:
    "This lot is still in a sale. Withdraw it, or wait until it ends unsold, before returning it to lax.art.",
  not_offered:
    "This lot has not been on sale. Delete the draft lot instead if the artwork should stay where it is.",
  has_winner: "This lot has a winning bidder, so the artwork cannot go back to lax.art.",
  elsewhere: "This artwork is no longer held by this lot, so it cannot be returned from here.",
};

export type ReturnMoveFacts = {
  registerLinked: boolean;
  lotStatus: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  hasWinner: boolean;
  /** Where the register now shows the artwork; null when unknown. */
  offerState: OfferState | null;
  /** The lot the register shows it in, when it is in a Bid sale. */
  offerLotId: string | null;
  lotId: string;
};

/** A lot that is over without a buyer (ended unsold, withdrawn or voided) may hand the artwork back. */
export function returnMoveBlockers(facts: ReturnMoveFacts): ReturnMoveBlocker[] {
  if (!facts.registerLinked) return ["no_register_record"];
  if (facts.hasWinner) return ["has_winner"];
  if (facts.lotStatus === "scheduled" || facts.lotStatus === "active") return ["still_in_sale"];
  if (facts.lotStatus === "draft") return ["not_offered"];
  if (facts.offerState === "sold" || facts.offerState === "lax_art") return ["elsewhere"];
  if (
    facts.offerState === "private_sale" ||
    (facts.offerState === "bid_sale" && facts.offerLotId !== facts.lotId)
  ) {
    return ["elsewhere"];
  }
  return [];
}

/** What the register history records for a confirmed move. */
export const MOVE_DIRECTIONS = ["to_auction", "to_lax_art"] as const;
export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

export type MoveRecord = {
  direction: MoveDirection;
  /** The sale chosen, for a move to auction. */
  saleId?: string;
  /** The draft lot made (to auction) or the lot handed back (to lax.art). */
  lotId?: string;
  /** The Shop artwork reopened as a draft, for a return. */
  shopArtworkId?: string;
  /** Set when the consignor's agreement to sell at auction was confirmed. */
  consignorAgreed?: true;
  confirmedBy: string;
};
