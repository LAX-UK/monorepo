import { z } from "zod";

export const IDENTITY_EVENT_SCHEMA_VERSION = 1 as const;

export const IDENTITY_EVENT_TYPES = {
  PROFILE_UPDATED: "user.profile_updated",
  DELETION_REQUESTED: "user.deletion_requested",
  DELETION_CANCELLED: "user.deletion_cancelled",
  IDENTITY_DISABLED: "user.identity_disabled",
  IDENTITY_ENABLED: "user.identity_enabled",
  IDENTITY_MERGED: "user.identity_merged",
  IDENTITY_DELETED: "user.identity_deleted",
  SESSION_REVOKED: "user.session_revoked",
  CREDENTIAL_CHANGED: "user.credential_changed",
} as const;

export type IdentityEventType = (typeof IDENTITY_EVENT_TYPES)[keyof typeof IDENTITY_EVENT_TYPES];

const identityEventBaseSchemaV1 = z.object({
  schemaVersion: z.literal(IDENTITY_EVENT_SCHEMA_VERSION),
  subjectId: z.string(),
});

export const userProfileUpdatedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export const userDeletionRequestedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  requestedAt: z.string().datetime(),
});

export const userDeletionCancelledPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  cancelledAt: z.string().datetime(),
});

export const userIdentityDisabledPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  disabledAt: z.string().datetime(),
  reason: z.string().optional(),
});

export const userIdentityEnabledPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  enabledAt: z.string().datetime(),
});

export const userIdentityMergedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  retiredSubjectId: z.string(),
  mergedAt: z.string().datetime(),
});

export const userSessionRevokedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  sessionId: z.string().optional(),
  revokedAt: z.string().datetime(),
});

export const userCredentialChangedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  credentialType: z.literal("password"),
  changeType: z.enum(["create", "update", "revoke", "delete"]),
  changedAt: z.string().datetime(),
});

export const userIdentityDeletedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  deletedAt: z.string().datetime(),
});

export type UserProfileUpdatedPayloadV1 = z.infer<typeof userProfileUpdatedPayloadSchemaV1>;
export type UserDeletionRequestedPayloadV1 = z.infer<typeof userDeletionRequestedPayloadSchemaV1>;
export type UserDeletionCancelledPayloadV1 = z.infer<typeof userDeletionCancelledPayloadSchemaV1>;
export type UserIdentityDisabledPayloadV1 = z.infer<typeof userIdentityDisabledPayloadSchemaV1>;
export type UserIdentityEnabledPayloadV1 = z.infer<typeof userIdentityEnabledPayloadSchemaV1>;
export type UserIdentityMergedPayloadV1 = z.infer<typeof userIdentityMergedPayloadSchemaV1>;
export type UserSessionRevokedPayloadV1 = z.infer<typeof userSessionRevokedPayloadSchemaV1>;
export type UserCredentialChangedPayloadV1 = z.infer<typeof userCredentialChangedPayloadSchemaV1>;
export type UserIdentityDeletedPayloadV1 = z.infer<typeof userIdentityDeletedPayloadSchemaV1>;

export type IdentityEventPayloadV1 =
  | UserProfileUpdatedPayloadV1
  | UserDeletionRequestedPayloadV1
  | UserDeletionCancelledPayloadV1
  | UserIdentityDisabledPayloadV1
  | UserIdentityEnabledPayloadV1
  | UserIdentityMergedPayloadV1
  | UserSessionRevokedPayloadV1
  | UserCredentialChangedPayloadV1
  | UserIdentityDeletedPayloadV1;

export const identityEventPayloadSchemasV1 = {
  [IDENTITY_EVENT_TYPES.PROFILE_UPDATED]: userProfileUpdatedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.DELETION_REQUESTED]: userDeletionRequestedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.DELETION_CANCELLED]: userDeletionCancelledPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_DISABLED]: userIdentityDisabledPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_ENABLED]: userIdentityEnabledPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_MERGED]: userIdentityMergedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.SESSION_REVOKED]: userSessionRevokedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.CREDENTIAL_CHANGED]: userCredentialChangedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_DELETED]: userIdentityDeletedPayloadSchemaV1,
} as const;
