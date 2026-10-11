import { type Static, Type } from "@sinclair/typebox";

export const AdminAuditEntrySchema = Type.Object({
  auditId: Type.String({ format: "uuid" }),
  actorSubjectId: Type.String(),
  capability: Type.String(),
  action: Type.String(),
  targetType: Type.String(),
  targetId: Type.String(),
  createdAt: Type.String(),
});

export const AdminAuditListSchema = Type.Object({
  items: Type.Array(AdminAuditEntrySchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export const AdminDisputeListItemSchema = Type.Object({
  disputeId: Type.String({ format: "uuid" }),
  orderId: Type.String({ format: "uuid" }),
  stripeDisputeId: Type.String(),
  status: Type.String(),
  amountPence: Type.Integer(),
  openedAt: Type.String(),
  closedAt: Type.Union([Type.String(), Type.Null()]),
});

export const AdminDisputeListSchema = Type.Object({
  items: Type.Array(AdminDisputeListItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
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
export type AdminEffectiveSettings = Static<typeof AdminEffectiveSettingsSchema>;
