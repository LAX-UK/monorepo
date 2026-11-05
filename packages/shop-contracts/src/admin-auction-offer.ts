import { type Static, Type } from "@sinclair/typebox";
import { AdminLaxArtOfferBlockerSchema } from "./admin-offer-on-lax-art.js";
import { AdminBidLotRefSchema } from "./admin-where-it-is.js";

/**
 * LAX Admin's "Offer at auction": staff move an original from lax.art to a LAX Bid sale. The
 * assessment says whether the original can move and why not; the move withdraws the lax.art
 * listing and makes the draft lot in the chosen sale.
 */

export const AdminAuctionOfferAssessmentSchema = Type.Object({
  /** The register record; null when a lax.art original has none yet. */
  registerId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  /** The lax.art listing; null when the record has none (the lot is made straight from Zoho's data). */
  artworkId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  title: Type.String(),
  /** The stock code in the artwork register; null when the artwork has no register record. */
  stockCode: Type.Union([Type.String(), Type.Null()]),
  /** On lax.art right now, so offering it takes it down. */
  onLaxArt: Type.Boolean(),
  /** A lax.art draft exists. It stays a draft: a draft holds nothing. */
  laxArtDraft: Type.Boolean(),
  /** The draft lot LAX Bid already holds for this artwork, when it does. */
  draftLot: Type.Union([AdminBidLotRefSchema, Type.Null()]),
  /** The lot holding the artwork in a LAX Bid sale, for the link in a refusal. */
  holdingLotId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  eligible: Type.Boolean(),
  /** Why the artwork cannot be offered, most important first, with the link that goes with each. */
  blockers: Type.Array(AdminLaxArtOfferBlockerSchema),
});
export type AdminAuctionOfferAssessment = Static<typeof AdminAuctionOfferAssessmentSchema>;

export const AdminAuctionSaleOptionSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  title: Type.String(),
  startsAt: Type.String({ format: "date-time" }),
});
export type AdminAuctionSaleOption = Static<typeof AdminAuctionSaleOptionSchema>;

export const AdminAuctionSalesSchema = Type.Object({
  /** False while LAX Bid's address and credential are not set on this environment. */
  connected: Type.Boolean(),
  sales: Type.Array(AdminAuctionSaleOptionSchema),
});
export type AdminAuctionSales = Static<typeof AdminAuctionSalesSchema>;

export const AdminOfferAtAuctionBodySchema = Type.Object({
  saleId: Type.String({ format: "uuid" }),
  /** In pounds, for example "250" or "250.00". */
  startingPrice: Type.String({ pattern: "^\\d{1,9}(\\.\\d{1,2})?$" }),
  /** Staff confirm the consignor agreed to sell at auction; who confirmed is recorded. */
  consignorAgreed: Type.Literal(true),
});
export type AdminOfferAtAuctionBody = Static<typeof AdminOfferAtAuctionBodySchema>;

export const AdminOfferAtAuctionResponseSchema = Type.Object({
  lotId: Type.String({ format: "uuid" }),
  saleId: Type.String({ format: "uuid" }),
  saleTitle: Type.String(),
  /** False when the artwork was already off lax.art (a retry, or it was never listed). */
  withdrawnFromLaxArt: Type.Boolean(),
  /** False when the draft lot already existed: asking again returns the same lot. */
  created: Type.Boolean(),
});
export type AdminOfferAtAuctionResponse = Static<typeof AdminOfferAtAuctionResponseSchema>;
