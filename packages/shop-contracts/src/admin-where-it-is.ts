import { type Static, Type } from "@sinclair/typebox";

const PlaceKeySchema = Type.Union([
  Type.Literal("not_offered"),
  Type.Literal("draft_lax_art"),
  Type.Literal("lax_art"),
  Type.Literal("draft_bid_lot"),
  Type.Literal("bid_sale"),
  Type.Literal("private_sale"),
  Type.Literal("withdrawn"),
  Type.Literal("sold"),
]);

/** A LAX Bid lot, as far as a link to it needs. */
export const AdminBidLotRefSchema = Type.Object({
  lotId: Type.String({ format: "uuid" }),
  saleTitle: Type.Union([Type.String(), Type.Null()]),
});
export type AdminBidLotRef = Static<typeof AdminBidLotRefSchema>;

/** Where an original is, as the record and the artwork page draw it (see `deriveWhereItIs`). */
export const AdminWhereItIsSchema = Type.Object({
  key: PlaceKeySchema,
  chip: Type.Object({
    label: Type.String(),
    tone: Type.Union([
      Type.Literal("neutral"),
      Type.Literal("info"),
      Type.Literal("success"),
      Type.Literal("warning"),
    ]),
    marker: Type.Union([Type.Literal("hollow"), Type.Literal("filled"), Type.Literal("check")]),
  }),
  /** Withdrawn: where from. Sold: where, as it reads after "Sold". */
  from: Type.Union([Type.String(), Type.Null()]),
  /** When the artwork got here (published, withdrawn or sold), when the history says. */
  since: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  /** The LAX Bid lot, for a draft lot or a lot in a sale; null elsewhere. */
  bidLot: Type.Union([AdminBidLotRefSchema, Type.Null()]),
});
export type AdminWhereItIs = Static<typeof AdminWhereItIsSchema>;
