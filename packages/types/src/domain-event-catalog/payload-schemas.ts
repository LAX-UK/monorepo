import { z } from "zod";

/** Default v1 payload when no stricter contract is frozen yet. */
export const looseDomainEventPayloadV1 = z.record(z.string(), z.unknown());
export const emptyDomainEventPayloadV1 = z.object({}).strict();
const rfc3339Timestamp = z.string().datetime({ offset: true });

export const userRegisteredPayloadSchemaV1 = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string(),
  source: z.enum(["credential", "google", "apple", "backfill"]),
  image: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  emailVerified: z.boolean().optional(),
  createdAt: rfc3339Timestamp.optional(),
});

export const userProfileUpdatedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  updatedAt: rfc3339Timestamp,
});

export const userDeletionRequestedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  requestedAt: rfc3339Timestamp,
});

export const userDeletionCancelledPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  cancelledAt: rfc3339Timestamp,
});

export const userIdentityDisabledPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  disabledAt: rfc3339Timestamp,
  reason: z.string().optional(),
});

export const userIdentityEnabledPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  enabledAt: rfc3339Timestamp,
});

export const userIdentityMergedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  retiredSubjectId: z.string(),
  mergedAt: rfc3339Timestamp,
});

export const userIdentityDeletedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  deletedAt: rfc3339Timestamp,
});

export const userSessionRevokedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  sessionId: z.string().optional(),
  revokedAt: rfc3339Timestamp,
});

export const userCredentialChangedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  subjectId: z.string(),
  credentialType: z.literal("password"),
  changeType: z.enum(["create", "update", "revoke", "delete"]),
  changedAt: rfc3339Timestamp,
});

export const userEmailVerifiedPayloadSchemaV1 = z.object({
  userId: z.string(),
  email: z.string(),
  verifiedAt: rfc3339Timestamp,
});

export const bidFirstForUserPayloadSchemaV1 = z.object({
  bidId: z.string().uuid(),
  lotId: z.string().uuid(),
  userId: z.string(),
  amountCents: z.number().int().nonnegative(),
  placedAt: rfc3339Timestamp,
});

export const bidOutbidPayloadSchemaV1 = z.object({
  previousBidId: z.string().uuid(),
  lotId: z.string().uuid(),
  userId: z.string(),
  newHighAmountCents: z.number().int().nonnegative(),
});

export const bidLotWonPayloadSchemaV1 = z.object({
  lotId: z.string().uuid(),
  userId: z.string(),
  winningBidId: z.string().uuid(),
  amountCents: z.number().int().nonnegative(),
  endedAt: rfc3339Timestamp,
});

export const amlScreeningPayloadSchemaV1 = z.object({
  screeningId: z.string(),
  userId: z.string(),
  providerSessionId: z.string().optional(),
  outcome: z.string(),
  matchStatus: z.string().optional(),
  monitorStatus: z.string().optional(),
  totalHits: z.number().optional(),
  categories: z.array(z.string()).optional(),
  reasons: z.array(z.string()).optional(),
});

export const sourceOfFundsRequiredPayloadSchemaV1 = z.object({
  sourceOfFundsId: z.string(),
  userId: z.string(),
  trigger: z.string(),
  thresholdAmount: z.string(),
  exposureAmount: z.string(),
  currency: z.string(),
});

export const sourceOfFundsReviewedPayloadSchemaV1 = z.object({
  sourceOfFundsId: z.string(),
  userId: z.string(),
  status: z.string(),
  trigger: z.string(),
});
