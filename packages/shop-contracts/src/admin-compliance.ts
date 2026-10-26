import { type Static, Type } from "@sinclair/typebox";
import { AdminWorkListCountsSchema } from "./admin-work-lists.js";

export const AdminAuditEntrySchema = Type.Object({
  auditId: Type.String({ format: "uuid" }),
  actorSubjectId: Type.String(),
  capability: Type.String(),
  action: Type.String(),
  targetType: Type.String(),
  targetId: Type.String(),
  createdAt: Type.String(),
  /* The rest is optional so the admin parses responses from an older shop-api. */
  /** From the actor's LAX profile; null for the platform itself or someone without a profile. */
  actorName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  actorEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  /** The recorded state before and after the change, when the event keeps one. */
  before: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  after: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
});

export const AdminAuditListSchema = Type.Object({
  items: Type.Array(AdminAuditEntrySchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});
export type AdminAuditList = Static<typeof AdminAuditListSchema>;

export const AdminDisputeListItemSchema = Type.Object({
  disputeId: Type.String({ format: "uuid" }),
  orderId: Type.String({ format: "uuid" }),
  stripeDisputeId: Type.String(),
  status: Type.String(),
  amountPence: Type.Integer(),
  openedAt: Type.String(),
  closedAt: Type.Union([Type.String(), Type.Null()]),
  /* The rest is optional so the admin parses responses from an older shop-api. */
  buyerName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  buyerEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  /** The order's reference, "LAX-S-10482". */
  orderReference: Type.Optional(Type.String()),
});

export const AdminDisputeListSchema = Type.Object({
  items: Type.Array(AdminDisputeListItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  /** Optional so the admin parses responses from an older shop-api. */
  counts: Type.Optional(AdminWorkListCountsSchema),
});

export const AdminEffectiveSettingsSchema = Type.Object({
  cancellationDaysAfterPossession: Type.Union([Type.Integer(), Type.Null()]),
  personalisedGoodsCancellationExempt: Type.Boolean(),
  vatStandardRateBp: Type.Union([Type.Integer(), Type.Null()]),
  payoutsEnabled: Type.Boolean(),
  merchandiseEnabled: Type.Boolean(),
  originalsEnabled: Type.Boolean(),
  thirdPartyEnabled: Type.Boolean(),
});

export type AdminAuditEntry = Static<typeof AdminAuditEntrySchema>;
export type AdminDisputeListItem = Static<typeof AdminDisputeListItemSchema>;
export type AdminDisputeList = Static<typeof AdminDisputeListSchema>;
export type AdminEffectiveSettings = Static<typeof AdminEffectiveSettingsSchema>;
