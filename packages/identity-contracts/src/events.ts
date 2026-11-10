import { z } from "zod";
import { ACCOUNT_TIME_ZONE_MODES, accountPlaceZoneSchema } from "./account-time-zone.js";

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
  /**
   * A social sign-in (Google or Apple) was removed from the account by the person. Replaced by
   * SIGN_IN_METHOD_REMOVED, which also covers passkeys; kept so events already recorded still read.
   */
  SIGN_IN_METHOD_UNLINKED: "user.sign_in_method_unlinked",
  /** The person added a way to sign in: Google, Apple or a passkey. */
  SIGN_IN_METHOD_ADDED: "user.sign_in_method_added",
  /** The person removed a way to sign in: Google, Apple or a passkey. */
  SIGN_IN_METHOD_REMOVED: "user.sign_in_method_removed",
  /** A password set before the email was confirmed was removed when Google or Apple proved it. */
  UNCONFIRMED_PASSWORD_REMOVED: "user.unconfirmed_password_removed",
  /** A Google or Apple sign-in or link was refused because the account is a staff account. */
  SOCIAL_LINK_REFUSED_STAFF: "user.social_link_refused_staff",
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
  /** LAX Account's time zone choice; both fields travel together when either changes. */
  timeZoneMode: z.enum(ACCOUNT_TIME_ZONE_MODES).optional(),
  /** Fixed: the chosen city. Automatic: the device zone last reported, or null. */
  timeZone: accountPlaceZoneSchema.nullable().optional(),
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

/** Which method, and when. No name, address or key: a passkey's name is the person's own. */
export const userSignInMethodAddedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  method: z.enum(["google", "apple", "passkey"]),
  addedAt: rfc3339Timestamp,
});

export const userSignInMethodRemovedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  method: z.enum(["google", "apple", "passkey"]),
  removedAt: rfc3339Timestamp,
});

export const userUnconfirmedPasswordRemovedPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  /** The provider whose proof of the email caused the removal. */
  provider: z.enum(["google", "apple"]),
  removedAt: rfc3339Timestamp,
});

export const userSocialLinkRefusedStaffPayloadSchemaV1 = identityEventBaseSchemaV1.extend({
  provider: z.enum(["google", "apple"]),
  /** What was refused: joining the provider to the account, or signing in through an older link. */
  attempt: z.enum(["link", "sign_in"]),
  refusedAt: rfc3339Timestamp,
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
export type UserSignInMethodAddedPayloadV1 = z.infer<typeof userSignInMethodAddedPayloadSchemaV1>;
export type UserSignInMethodRemovedPayloadV1 = z.infer<
  typeof userSignInMethodRemovedPayloadSchemaV1
>;
export type UserUnconfirmedPasswordRemovedPayloadV1 = z.infer<
  typeof userUnconfirmedPasswordRemovedPayloadSchemaV1
>;
export type UserSocialLinkRefusedStaffPayloadV1 = z.infer<
  typeof userSocialLinkRefusedStaffPayloadSchemaV1
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
  | UserSignInMethodAddedPayloadV1
  | UserSignInMethodRemovedPayloadV1
  | UserUnconfirmedPasswordRemovedPayloadV1
  | UserSocialLinkRefusedStaffPayloadV1
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
  [IDENTITY_EVENT_TYPES.SIGN_IN_METHOD_ADDED]: userSignInMethodAddedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.SIGN_IN_METHOD_REMOVED]: userSignInMethodRemovedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.UNCONFIRMED_PASSWORD_REMOVED]:
    userUnconfirmedPasswordRemovedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.SOCIAL_LINK_REFUSED_STAFF]: userSocialLinkRefusedStaffPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.IDENTITY_DELETED]: userIdentityDeletedPayloadSchemaV1,
  [IDENTITY_EVENT_TYPES.DATA_EXPORT_REQUESTED]: subjectDataExportRequestedPayloadSchemaV1,
} as const;
