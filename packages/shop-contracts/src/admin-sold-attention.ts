import { type Static, Type } from "@sinclair/typebox";

/**
 * "Zoho says Sold, but this artwork is still for sale": the staff items that wait for a decision.
 * The words come from the artwork register contract, so every screen says the same thing.
 */

export const ADMIN_SOLD_ATTENTION_REASON_MAX_LENGTH = 500;

const ActionKindSchema = Type.Union([
  Type.Literal("unpublish_lax_art"),
  Type.Literal("withdraw_lot"),
  Type.Literal("withdraw_offer"),
  Type.Literal("open_in_zoho"),
  Type.Literal("not_sold"),
]);

export const AdminSoldAttentionItemSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  registerId: Type.String({ format: "uuid" }),
  zohoProductId: Type.String(),
  zohoStatus: Type.Union([Type.Literal("Sold"), Type.Literal("Reserved")]),
  place: Type.Union([
    Type.Literal("lax_art"),
    Type.Literal("bid_sale"),
    Type.Literal("bid_reoffer"),
    Type.Literal("private_sale"),
  ]),
  /** The listing, lot or offer it is still for sale in, for the link behind the action. */
  placeRefId: Type.Union([Type.String(), Type.Null()]),
  tone: Type.Literal("danger"),
  title: Type.String(),
  body: Type.String(),
  actions: Type.Array(Type.Object({ kind: ActionKindSchema, label: Type.String() })),
  raisedAt: Type.String({ format: "date-time" }),
});

export const AdminSoldAttentionListSchema = Type.Object({
  items: Type.Array(AdminSoldAttentionItemSchema),
  /** What the list says when it is empty. */
  emptyMessage: Type.String(),
});

export const AdminSoldAttentionParamsSchema = Type.Object({
  attentionId: Type.String({ format: "uuid" }),
});

export const AdminSoldAttentionOverrideBodySchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: ADMIN_SOLD_ATTENTION_REASON_MAX_LENGTH }),
});

export const AdminSoldAttentionOverrideResultSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  registerId: Type.String({ format: "uuid" }),
});

export type AdminSoldAttentionItem = Static<typeof AdminSoldAttentionItemSchema>;
export type AdminSoldAttentionList = Static<typeof AdminSoldAttentionListSchema>;
export type AdminSoldAttentionOverrideBody = Static<typeof AdminSoldAttentionOverrideBodySchema>;
export type AdminSoldAttentionOverrideResult = Static<
  typeof AdminSoldAttentionOverrideResultSchema
>;
