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
});
export type AdminWhereItIs = Static<typeof AdminWhereItIsSchema>;
