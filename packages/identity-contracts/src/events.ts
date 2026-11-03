import { z } from "zod";

export const IDENTITY_EVENT_SCHEMA_VERSION = 1 as const;

export const IDENTITY_EVENT_TYPES = {
  PROFILE_UPDATED: "user.profile_updated",
  DELETION_REQUESTED: "user.deletion_requested",
  DELETION_CANCELLED: "user.deletion_cancelled",
  /** The daily purge found an open obligation and kept the details; the work stays with staff. */
  DELETION_HELD: "user.deletion_held",
  IDENTITY_DISABLED: "user.identity_disabled",
  IDENTITY_ENABLED: "user.identity_enabled",
  IDENTITY_MERGED: "user.identity_merged",
  IDENTITY_DELETED: "user.identity_deleted",
  SESSION_REVOKED: "user.session_revoked",
  CREDENTIAL_CHANGED: "user.credential_changed",
  /** A social sign-in (Google or Apple) was removed from the account by the person. */
  SIGN_IN_METHOD_UNLINKED: "user.sign_in_method_unlinked",
  /** A person asked for a copy of their data; the worker starts collecting. Ids only, no personal fields. */
  DATA_EXPORT_REQUESTED: "subject.data_export_requested",
} as const;

export type IdentityEventType = (typeof IDENTITY_EVENT_TYPES)[keyof typeof IDENTITY_EVENT_TYPES];
const rfc3339Timestamp = z.string().datetime({ offset: true });

const identityEventBaseSchemaV1 = z.object({
  schemaVersion: z.literal(IDENTITY_EVENT_SCHEMA_VERSION),
  subjectId: z.string(),
});

export const userProfileUpdatedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  phoneVerified: z.boolean().optional(),
  image: z.string().nullable().optional(),
  updatedAt: rfc3339Timestamp,
});

export const userDeletionRequestedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  requestedAt: rfc3339Timestamp,
});

export const userDeletionCancelledPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  cancelledAt: rfc3339Timestamp,
});

export const userDeletionHeldPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  heldAt: rfc3339Timestamp,
  /** What is still open, in the product's own words. No personal data. */
  reasons: z
    .array(
      z.object({
        code: z.string().min(1).max(100),
        message: z.string().min(1).max(300),
        href: z.string().url().nullable(),
      }),
    )
    .max(50),
});

export const userIdentityDisabledPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  disabledAt: rfc3339Timestamp,
  reason: z.string().optional(),
});

export const userIdentityEnabledPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  enabledAt: rfc3339Timestamp,
});

export const userIdentityMergedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  retiredSubjectId: z.string(),
  mergedAt: rfc3339Timestamp,
});

export const userSessionRevokedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  sessionId: z.string().optional(),
  revokedAt: rfc3339Timestamp,
});

export const userCredentialChangedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  credentialType: z.literal("password"),
  changeType: z.enum(["create", "update", "revoke", "delete"]),
  changedAt: rfc3339Timestamp,
});

export const userSignInMethodUnlinkedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  provider: z.enum(["google", "apple"]),
  unlinkedAt: rfc3339Timestamp,
});

export const userIdentityDeletedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  deletedAt: rfc3339Timestamp,
});

export const subjectDataExportRequestedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  exportId: z.string().min(1),
});

export type SubjectDataExportRequestedPayloadV1 = z.infer<
  typeof subjectDataExportRequestedPayloadSchemaV1
>;
export type UserProfileUpdatedPayloadV1 = z.infer<typeof userProfileUpdatedPayloadSchemaV1>;
export type UserDeletionRequestedPayloadV1 = z.infer<typeof userDeletionRequestedPayloadSchemaV1>;
export type UserDeletionCancelledPayloadV1 = z.infer<typeof userDeletionCancelledPayloadSchemaV1>;
export type UserDeletionHeldPayloadV1 = z.infer<typeof userDeletionHeldPayloadSchemaV1>;
export type UserIdentityDisabledPayloadV1 = z.infer<typeof userIdentityDisabledPayloadSchemaV1>;
export type UserIdentityEnabledPayloadV1 = z.infer<typeof userIdentityEnabledPayloadSchemaV1>;
export type UserIdentityMergedPayloadV1 = z.infer<typeof userIdentityMergedPayloadSchemaV1>;
export type UserSessionRevokedPayloadV1 = z.infer<typeof userSessionRevokedPayloadSchemaV1>;
export type UserCredentialChangedPayloadV1 = z.infer<typeof userCredentialChangedPayloadSchemaV1>;
export type UserSignInMethodUnlinkedPayloadV1 = z.infer<
  typeof userSignInMethodUnlinkedPayloadSchemaV1
>;
export type UserIdentityDeletedPayloadV1 = z.infer<typeof userIdentityDeletedPayloadSchemaV1>;

export type IdentityEventPayloadV1 =
  | UserProfileUpdatedPayloadV1
  | UserDeletionRequestedPayloadV1
  | UserDeletionCancelledPayloadV1
  | UserDeletionHeldPayloadV1
  | UserIdentityDisabledPayloadV1
  | UserIdentityEnabledPayloadV1
  | UserIdentityMergedPayloadV1
  | UserSessionRevokedPayloadV1
  | UserCredentialChangedPayloadV1
  | UserSignInMethodUnlinkedPayloadV1
  | UserIdentityDeletedPayloadV1
  | SubjectDataExportRequestedPayloadV1;

export const identityEventPayloadSchemasV1 = {
  [IDENTITY_EVENT_TYPES.PROFILE_UPDATED]: userProfileUpdatedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.DELETION_REQUESTED]: userDeletionRequestedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.DELETION_CANCELLED]: userDeletionCancelledPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.DELETION_HELD]: userDeletionHeldPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_DISABLED]: userIdentityDisabledPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_ENABLED]: userIdentityEnabledPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_MERGED]: userIdentityMergedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.SESSION_REVOKED]: userSessionRevokedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.CREDENTIAL_CHANGED]: userCredentialChangedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.SIGN_IN_METHOD_UNLINKED]: userSignInMethodUnlinkedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_DELETED]: userIdentityDeletedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.DATA_EXPORT_REQUESTED]: subjectDataExportRequestedPayloadSchemaV1,
} as const;
