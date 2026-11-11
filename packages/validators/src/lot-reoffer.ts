import {
  DEFAULT_OFFER_DAYS,
  MAX_OFFER_DAYS,
  MIN_OFFER_DAYS,
  REOFFER_STATUSES,
  SELLER_CONSENT_STATUSES,
} from "@auction/domain";
import { z } from "zod";

/**
 * API shapes for re-offering a lot after a buyer default. Amounts are whole pence; moments are
 * ISO strings. Three audiences, three shapes: staff see everything, the seller and the next
 * bidder see only their own side. Member shapes are strict and never carry staff figures (the
 * claimable shortfall) or the other party's identity.
 */

const pence = z.number().int().nonnegative();
const moment = z.string().datetime({ offset: true });
const note = z.string().trim().min(1).max(1000);

export const reofferStatusSchema = z.enum(REOFFER_STATUSES);
export const sellerConsentStatusSchema = z.enum(SELLER_CONSENT_STATUSES);

export const skippedBidderSchema = z.object({
  userId: z.string().min(1),
  legalEntityId: z.string().min(1),
  amountMinor: pence,
  reason: z.enum(["suspended", "closed", "deletion_pending", "already_offered"]),
});

/** Staff send an offer: how long the bidder has, 1 to 7 days (3 by default). */
export const sendReofferBodySchema = z
  .object({
    offerDays: z.number().int().min(MIN_OFFER_DAYS).max(MAX_OFFER_DAYS).default(DEFAULT_OFFER_DAYS),
  })
  .strict();
export type SendReofferBody = z.infer<typeof sendReofferBodySchema>;

/** Staff record an answer the seller gave by phone, email or in person. */
export const recordSellerAnswerBodySchema = z
  .object({ answer: z.enum(["given", "refused"]), note })
  .strict();
export type RecordSellerAnswerBody = z.infer<typeof recordSellerAnswerBodySchema>;

export const withdrawReofferBodySchema = z.object({ note }).strict();
export type WithdrawReofferBody = z.infer<typeof withdrawReofferBodySchema>;

/** The seller's own answer in their workspace. */
export const sellerReofferAnswerBodySchema = z
  .object({
    answer: z.enum(["given", "refused"]),
    /** Why the seller said no (a later sale, return to me, talk to us). */
    declinePreference: z.enum(["later_sale", "return_to_me", "talk_to_us"]).optional(),
  })
  .strict();
export type SellerReofferAnswerBody = z.infer<typeof sellerReofferAnswerBodySchema>;

const claimableShortfallSchema = z.object({
  hammerDifferenceMinor: pence,
  premiumLostMinor: pence,
  totalMinor: pence,
});

/** One offer as staff see it. */
export const staffReofferSchema = z.object({
  id: z.string().min(1),
  lotId: z.string().min(1),
  sequence: z.number().int().min(1),
  status: reofferStatusSchema,
  consentStatus: sellerConsentStatusSchema,
  bidder: z.object({ userId: z.string().min(1), legalEntityId: z.string().min(1) }),
  offerMinor: pence,
  originalHammerMinor: pence,
  belowReserve: z.boolean(),
  consentDueAt: moment.nullable(),
  offerEndsAt: moment.nullable(),
  /** Staff only: never shown to the seller, the bidder or the defaulting buyer. */
  claimableShortfall: claimableShortfallSchema,
  skippedBidders: z.array(skippedBidderSchema),
});
export type StaffReoffer = z.infer<typeof staffReofferSchema>;

/** What the seller needs to decide. It never names a bidder. */
export const sellerReofferViewSchema = z
  .object({
    id: z.string().min(1),
    lotId: z.string().min(1),
    status: reofferStatusSchema,
    consentStatus: sellerConsentStatusSchema,
    offerMinor: pence,
    originalHammerMinor: pence,
    estimatedProceedsMinor: pence,
    originalProceedsMinor: pence,
    reserveMinor: pence.nullable(),
    belowReserve: z.boolean(),
    answerDueAt: moment.nullable(),
  })
  .strict();
export type SellerReofferView = z.infer<typeof sellerReofferViewSchema>;

/** What the next bidder sees. It never names the seller or the defaulting buyer. */
export const bidderReofferViewSchema = z
  .object({
    id: z.string().min(1),
    lotId: z.string().min(1),
    status: reofferStatusSchema,
    hammerMinor: pence,
    buyersPremiumMinor: pence,
    vatMinor: pence,
    totalMinor: pence,
    endsAt: moment,
  })
  .strict();
export type BidderReofferView = z.infer<typeof bidderReofferViewSchema>;
