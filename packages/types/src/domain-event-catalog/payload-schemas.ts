import { z } from "zod";

/** Default v1 payload when no stricter contract is frozen yet. */
export const looseDomainEventPayloadV1 = z.record(z.string(), z.unknown());

export const userRegisteredPayloadSchemaV1 = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string(),
  source: z.enum(["credential", "google", "apple", "backfill"]),
});

export const userEmailVerifiedPayloadSchemaV1 = z.object({
  userId: z.string(),
  email: z.string(),
  verifiedAt: z.string().datetime(),
});

export const userLinkedExternalPayloadSchemaV1 = z.object({
  userId: z.string(),
  provider: z.string(),
  externalId: z.string(),
  linkedAt: z.string().datetime(),
});

export const bidFirstForUserPayloadSchemaV1 = z.object({
  bidId: z.string().uuid(),
  lotId: z.string().uuid(),
  userId: z.string(),
  amountCents: z.number().int().nonnegative(),
  placedAt: z.string().datetime(),
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
  endedAt: z.string().datetime(),
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
