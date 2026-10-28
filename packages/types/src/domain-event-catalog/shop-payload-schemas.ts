import { z } from "zod";

const rfc3339Timestamp = z.string().datetime({ offset: true });

export const shopOrderPaidPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  orderId: z.string().uuid(),
  identitySubjectId: z.string(),
  totalPence: z.number().int().nonnegative(),
  paidAt: rfc3339Timestamp,
  lineCount: z.number().int().nonnegative(),
});

export const shopArtworkCreatedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  importKey: z.string(),
  slug: z.string(),
  eligibleForEditionAllocation: z.boolean(),
});

export const shopEditionsAllocatedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  importKey: z.string(),
  editionCount: z.number().int().nonnegative(),
});

export const shopEditionReservedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  orderId: z.string().uuid(),
  artworkId: z.string().uuid(),
  /** Null for an unnumbered print (open editions, and proofs, which carry a proof number). */
  editionNumber: z.number().int().positive().nullable(),
  /** Identifies the print in its run; optional so events recorded before it still parse. */
  stockRef: z.number().int().positive().optional(),
});

export const shopEditionReleasedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  orderId: z.string().uuid(),
  editionId: z.string().uuid(),
});

export const shopEditionSoldPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  orderId: z.string().uuid(),
  editionId: z.string().uuid(),
  buyerPartyId: z.string().uuid().optional(),
});

export const shopArtworkInterestRegisteredPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  artworkId: z.string().uuid(),
  identitySubjectId: z.string(),
  intent: z.enum(["notify_me", "enquiry"]),
});

export const shopArtworkUpdatedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  artworkId: z.string().uuid(),
});

export const shopSaleAuthorityChangedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  artworkId: z.string().uuid(),
  ownerPartyId: z.string().uuid(),
  authorisedCount: z.number().int().min(0).max(10),
});
