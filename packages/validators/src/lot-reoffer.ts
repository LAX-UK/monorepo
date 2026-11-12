import {
  BIDDER_REOFFER_STATUSES,
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

export const SELLER_DECLINE_PREFERENCES = ["later_sale", "return_to_me", "talk_to_us"] as const;
const declinePreference = z.enum(SELLER_DECLINE_PREFERENCES);

export const reofferStatusSchema = z.enum(REOFFER_STATUSES);
export const sellerConsentStatusSchema = z.enum(SELLER_CONSENT_STATUSES);

export const bidderReofferStatusSchema = z.enum(BIDDER_REOFFER_STATUSES);

export const skippedBidderSchema = z.object({
  userId: z.string().min(1),
  legalEntityId: z.string().min(1),
  amountMinor: pence,
  reason: z.enum(["suspended", "closed", "deletion_pending"]),
});

/** Staff start an offer of a defaulted lot to the next bidder; the lot's latest default is used. */
export const startReofferBodySchema = z
  .object({ buyerDefaultId: z.string().uuid().optional() })
  .strict();
export type StartReofferBody = z.infer<typeof startReofferBodySchema>;

/** The path of an offer. */
export const reofferIdParamSchema = z.object({ reofferId: z.string().uuid() });

/** Staff send an offer: how long the bidder has, 1 to 7 days (3 by default). */
export const sendReofferBodySchema = z
  .object({
    offerDays: z.number().int().min(MIN_OFFER_DAYS).max(MAX_OFFER_DAYS).default(DEFAULT_OFFER_DAYS),
  })
  .strict();
export type SendReofferBody = z.infer<typeof sendReofferBodySchema>;

/** Staff record an answer the seller gave by phone, email or in person. */
export const recordSellerAnswerBodySchema = z.discriminatedUnion("answer", [
  z.object({ answer: z.literal("given"), note }).strict(),
  z
    .object({ answer: z.literal("refused"), note, declinePreference: declinePreference.optional() })
    .strict(),
]);
export type RecordSellerAnswerBody = z.infer<typeof recordSellerAnswerBodySchema>;

export const withdrawReofferBodySchema = z.object({ note }).strict();
export type WithdrawReofferBody = z.infer<typeof withdrawReofferBodySchema>;

/** The seller's own answer in their workspace; a refusal says what to do with the lot. */
export const sellerReofferAnswerBodySchema = z.discriminatedUnion("answer", [
  z.object({ answer: z.literal("given") }).strict(),
  z.object({ answer: z.literal("refused"), declinePreference }).strict(),
]);
export type SellerReofferAnswerBody = z.infer<typeof sellerReofferAnswerBodySchema>;

/** The bidder accepts: a binding purchase at the total shown, with the terms ticked. */
export const acceptReofferBodySchema = z.object({ termsAccepted: z.literal(true) }).strict();
export type AcceptReofferBody = z.infer<typeof acceptReofferBodySchema>;

export const declineReofferBodySchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();
export type DeclineReofferBody = z.infer<typeof declineReofferBodySchema>;

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

/** How the seller's answer reached us: from their workspace, or recorded by our team. */
export const SELLER_ANSWER_CHANNELS = ["workspace", "recorded_by_staff"] as const;

/**
 * What the seller needs to decide, and where the request stands after. It names the work and
 * never a bidder.
 */
export const sellerReofferViewSchema = z
  .object({
    id: z.string().min(1),
    lotId: z.string().min(1),
    lotTitle: z.string(),
    lotNumber: z.number().int().nullable(),
    /** When the original sale of the lot ended. */
    lotEndedAt: moment,
    status: reofferStatusSchema,
    consentStatus: sellerConsentStatusSchema,
    offerMinor: pence,
    originalHammerMinor: pence,
    estimatedProceedsMinor: pence,
    originalProceedsMinor: pence,
    reserveMinor: pence.nullable(),
    belowReserve: z.boolean(),
    answerDueAt: moment.nullable(),
    answeredAt: moment.nullable(),
    answeredBy: z.enum(SELLER_ANSWER_CHANNELS).nullable(),
    declinePreference: declinePreference.nullable(),
    /** When the next bidder's offer ends, once it was sent. */
    offerEndsAt: moment.nullable(),
    /** When the next bidder accepted: the lot was sold again. */
    soldAt: moment.nullable(),
  })
  .strict();
export type SellerReofferView = z.infer<typeof sellerReofferViewSchema>;

/**
 * The price the bidder pays, line by line. A line that does not apply to the lot is `null`,
 * never zero: VAT on the lot only for a lot sold with VAT, the Artist's Resale Right only for a
 * lot that owes it. The total is the sum of the lines.
 */
export const bidderReofferPriceSchema = z
  .object({
    hammerMinor: pence,
    buyersPremiumMinor: pence,
    vatOnPremiumMinor: pence,
    vatOnLotMinor: pence.nullable(),
    artistsResaleRightMinor: pence.nullable(),
    totalMinor: pence,
  })
  .strict()
  .refine(
    (price) =>
      price.totalMinor ===
      price.hammerMinor +
        price.buyersPremiumMinor +
        price.vatOnPremiumMinor +
        (price.vatOnLotMinor ?? 0) +
        (price.artistsResaleRightMinor ?? 0),
    { message: "The total must equal the lines", path: ["totalMinor"] },
  );
export type BidderReofferPrice = z.infer<typeof bidderReofferPriceSchema>;

/** What the next bidder sees. It never names the seller or the defaulting buyer. */
export const bidderReofferViewSchema = z
  .object({
    id: z.string().min(1),
    lotId: z.string().min(1),
    status: bidderReofferStatusSchema,
    price: bidderReofferPriceSchema,
    endsAt: moment,
  })
  .strict();
export type BidderReofferView = z.infer<typeof bidderReofferViewSchema>;
