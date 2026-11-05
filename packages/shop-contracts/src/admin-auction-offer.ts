import { type Static, Type } from "@sinclair/typebox";

/**
 * LAX Admin's "Offer at auction": staff move an original from lax.art to a LAX Bid sale. The
 * assessment says whether the original can move and why not; the move withdraws the lax.art
 * listing and makes the draft lot in the chosen sale.
 */

export const AdminAuctionOfferAssessmentSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  title: Type.String(),
  /** The stock code in the artwork register; null when the artwork has no register record. */
  stockCode: Type.Union([Type.String(), Type.Null()]),
  /** On lax.art right now, so offering it takes it down. */
  onLaxArt: Type.Boolean(),
  eligible: Type.Boolean(),
  /** Why the original cannot move, in words for staff. Empty when it can. */
  reasons: Type.Array(Type.String()),
});
export type AdminAuctionOfferAssessment = Static<typeof AdminAuctionOfferAssessmentSchema>;

export const AdminAuctionSaleOptionSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  title: Type.String(),
  startsAt: Type.String({ format: "date-time" }),
});
export type AdminAuctionSaleOption = Static<typeof AdminAuctionSaleOptionSchema>;

export const AdminAuctionSalesSchema = Type.Object({
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
});
export type AdminOfferAtAuctionResponse = Static<typeof AdminOfferAtAuctionResponseSchema>;
