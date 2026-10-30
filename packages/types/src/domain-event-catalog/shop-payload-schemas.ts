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

/**
 * A Shop lead from guest checkout: published when the guest is first seen, when their marketing
 * consent changes and when they first pay. `leadSubjectId` keys the lead in the CRM until a LAX
 * account claims it.
 */
export const shopGuestLeadRecordedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  guestCustomerId: z.string().uuid(),
  leadSubjectId: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable(),
  /** The furthest step the lead reached; `enquired` is a lead that has only sent enquiries. */
  status: z.enum(["abandoned_checkout", "ordered", "enquired"]),
  source: z.string().min(1),
  marketingConsent: z.boolean(),
  /** When and to which wording the guest opted in; null without consent. */
  marketingConsentAt: rfc3339Timestamp.nullable(),
  marketingConsentVersion: z.string().nullable(),
  firstSeenAt: rfc3339Timestamp,
  lastSeenAt: rfc3339Timestamp,
  paidOrderCount: z.number().int().nonnegative(),
});

/** A LAX account verified a guest's email and took over their orders. */
export const shopGuestLeadClaimedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  guestCustomerId: z.string().uuid(),
  leadSubjectId: z.string().min(1),
  subjectId: z.string().min(1),
  claimedOrders: z.number().int().nonnegative(),
  /** Enquiries the guest sent that now show in the account. */
  claimedEnquiries: z.number().int().nonnegative().optional(),
});

/**
 * Staff erased a guest's personal data on request. Carries no personal data: the lead is named by
 * its subject so the CRM record can be deleted.
 */
export const shopGuestLeadErasedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  guestCustomerId: z.string().uuid(),
  leadSubjectId: z.string().min(1),
  erasedAt: rfc3339Timestamp,
});
