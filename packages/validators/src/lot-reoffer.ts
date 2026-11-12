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

const SELLER_CONSENT_CHANNELS = ["workspace", "recorded_by_staff", "house_stock"] as const;

/** The seller's request and answer as staff read them: who answered, how, and the note kept. */
export const staffConsentSchema = z.object({
  channel: z.enum(SELLER_CONSENT_CHANNELS).nullable(),
  requestedAt: moment,
  remindedAt: moment.nullable(),
  answeredAt: moment.nullable(),
  answeredByName: z.string().nullable(),
  note: z.string().nullable(),
  declinePreference: declinePreference.nullable(),
});

/** One offer as staff see it. */
export const staffReofferSchema = z.object({
  id: z.string().min(1),
  lotId: z.string().min(1),
  sequence: z.number().int().min(1),
  status: reofferStatusSchema,
  consentStatus: sellerConsentStatusSchema,
  bidder: z.object({
    userId: z.string().min(1),
    legalEntityId: z.string().min(1),
    accountName: z.string().nullable(),
  }),
  offerMinor: pence,
  /** What the bidder would pay, line by line (the invoice's own pricing). Staff see it before sending. */
  price: bidderReofferPriceSchema,
  /** The bid the offer is made at, and when the bidder placed it. */
  sourceBidId: z.string().min(1),
  bidPlacedAt: moment.nullable(),
  originalHammerMinor: pence,
  belowReserve: z.boolean(),
  consentDueAt: moment.nullable(),
  consent: staffConsentSchema,
  createdAt: moment,
  createdByName: z.string().nullable(),
  offerSentAt: moment.nullable(),
  offerEndsAt: moment.nullable(),
  respondedAt: moment.nullable(),
  declineReason: z.string().nullable(),
  closeReason: z.string().nullable(),
  closedByName: z.string().nullable(),
  /** The new buyer's invoice, once the offer was accepted. */
  invoiceId: z.string().nullable(),
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
    status: bidderReofferStatusSchema,
    price: bidderReofferPriceSchema,
    endsAt: moment,
  })
  .strict();
export type BidderReofferView = z.infer<typeof bidderReofferViewSchema>;

/** Who the lot would be offered to next, and why there may be nobody. */
export const nextBidderNoneReasonSchema = z.enum([
  "no_buyer",
  "offer_limit_reached",
  "no_other_bidder",
  "no_eligible_bidder",
]);
export type NextBidderNoneReason = z.infer<typeof nextBidderNoneReasonSchema>;

/**
 * Staff's look at the next step of a lot after a default: the bidder in line with their highest
 * placed bid (never a hidden maximum), the bidders after them and any passed over.
 */
export const reofferPreviewSchema = z.object({
  /** The lot sold on ATG: LAX has no buyer or bids to re-offer to (RA19). */
  soldOnAtg: z.boolean(),
  next: z
    .object({
      userId: z.string().min(1),
      legalEntityId: z.string().min(1),
      accountName: z.string().nullable(),
      bidMinor: pence,
      placedAt: moment,
      belowReserve: z.boolean(),
      /** Eligible bidders after this one (before the cap of three offers). */
      othersAfter: z.number().int().nonnegative(),
    })
    .nullable(),
  noneReason: nextBidderNoneReasonSchema.nullable(),
  skippedBidders: z.array(skippedBidderSchema),
  /** Offers already made for this default, out of the cap. */
  offersMade: z.number().int().nonnegative(),
});
export type ReofferPreview = z.infer<typeof reofferPreviewSchema>;

/** The buyer default the re-offer answers, for the lot page's rail. Staff only. */
export const staffBuyerDefaultSchema = z.object({
  id: z.string().min(1),
  recordedAt: moment,
  recordedByName: z.string().nullable(),
  reason: z.string(),
  outcome: z.enum(["returned_to_inventory", "offered_to_underbidder"]),
  originalHammerMinor: pence,
  wonAt: moment,
  buyerRestricted: z.boolean(),
  buyerUserId: z.string().min(1),
  buyerAccountName: z.string().nullable(),
  voidedInvoiceNumber: z.string().nullable(),
  voidedInvoiceTotalMinor: pence.nullable(),
  voidedInvoiceDueAt: moment.nullable(),
});
export type StaffBuyerDefault = z.infer<typeof staffBuyerDefaultSchema>;
