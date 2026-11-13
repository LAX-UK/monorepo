import { z } from "zod";

export const lotCreatedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
  source: z.enum(["staff_create", "sale_create", "submission", "emergency_add"]),
});

export const lotActivatedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
  activatedAt: z.string().datetime(),
});

export const lotAttachedToSalePayloadSchema = z.object({
  saleId: z.string().uuid(),
  lotNumber: z.number().nullable(),
  fromSaleId: z.string().uuid().nullable(),
  via: z.enum(["attach_endpoint", "patch", "wizard"]),
});

export const lotDetachedFromSalePayloadSchema = z.object({
  fromSaleId: z.string().uuid(),
});

export const lotPublishedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
});

export const lotUnpublishedPayloadSchema = z.object({
  saleId: z.string().uuid().nullable(),
  reason: z.enum(["sale_unpublish", "manual"]),
});

export const lotCancelledPayloadSchema = z.object({
  reason: z.enum([
    "manual",
    "sale_cancel",
    "sale_soft_delete",
    "soft_delete",
    "withdrawal",
    "admin_override",
  ]),
});

export const lotEndedTriggerSchema = z.enum([
  "timed",
  "clerk_hammer",
  "clerk_no_sale",
  "onsite_sale_end",
  "admin_override",
  "early_close",
]);

export const lotEndedPayloadSchema = z.object({
  outcome: z.enum(["sold", "no_sale"]),
  winnerId: z.string().nullable(),
  saleId: z.string().uuid().nullable(),
  trigger: lotEndedTriggerSchema,
  hammerPrice: z.string().nullable().optional(),
  hadWinner: z.boolean().optional(),
  endedAt: z.string().datetime().optional(),
});

export const lotVoidedPayloadSchema = z.object({
  reason: z.string(),
});

export const lotWithdrawalRequestedPayloadSchema = z.object({
  sellerLegalEntityId: z.string().uuid(),
});

export const lotWithdrawalDeclinedPayloadSchema = z.object({
  sellerLegalEntityId: z.string().uuid(),
  /** Staff-written explanation that goes to the seller in the decline notice. */
  reason: z.string(),
});

export const lotReturnedToInventoryPayloadSchema = z.object({
  fromStatus: z.enum(["ended", "cancelled", "voided"]),
  lastSaleId: z.string().uuid().nullable(),
  reason: z.string(),
  /** The reserve agreed with the seller for a relist, put on the lot as it returned. */
  reserveApplied: z
    .object({
      followUpId: z.string().uuid(),
      from: z.string().nullable(),
      to: z.string(),
    })
    .optional(),
});

export const lotBuyerDefaultedPayloadSchema = z.object({
  /** The voided invoice; null when none had been raised. */
  paymentId: z.string().uuid().nullable(),
  buyerId: z.string(),
  outcome: z.enum(["returned_to_inventory", "offered_to_underbidder"]),
  reason: z.string(),
  buyerRestricted: z.boolean(),
  offeredUserId: z.string().nullable(),
});

/** Who moved a re-offer: the seller, the bidder, staff (also on someone's behalf) or the clock. */
const reofferActorSchema = z.enum(["seller", "bidder", "staff", "clock"]);

/** What every event of one offer of a defaulted lot to one bidder says about the offer. */
const reofferEventBase = {
  reofferId: z.string().uuid(),
  buyerDefaultId: z.string().uuid(),
  /** 1 for the first offer of the default, up to 3. */
  sequence: z.number().int().min(1).max(3),
  actor: reofferActorSchema,
  /** Whole pence: the amount the bidder bid, the price of the offer. */
  amountPence: z.number().int().positive(),
};

export const lotReofferStartedPayloadSchema = z.object({
  ...reofferEventBase,
  offeredUserId: z.string(),
  offeredLegalEntityId: z.string().uuid(),
  /** `not_needed` for stock LAX owns; otherwise the seller is asked. */
  consentStatus: z.enum(["requested", "not_needed"]),
  originalHammerPence: z.number().int().nonnegative(),
});

export const lotSellerConsentGivenPayloadSchema = z.object({
  ...reofferEventBase,
  channel: z.enum(["workspace", "recorded_by_staff"]),
});

export const lotSellerConsentRefusedPayloadSchema = z.object({
  ...reofferEventBase,
  channel: z.enum(["workspace", "recorded_by_staff"]),
  preferredNext: z.enum(["later_sale", "return_to_me", "talk_to_us"]).nullable(),
});

export const lotSellerConsentLapsedPayloadSchema = z.object({ ...reofferEventBase });

export const lotReofferSentPayloadSchema = z.object({
  ...reofferEventBase,
  offerEndsAt: z.string().datetime(),
});

export const lotReofferAcceptedPayloadSchema = z.object({ ...reofferEventBase });

export const lotReofferDeclinedPayloadSchema = z.object({
  ...reofferEventBase,
  reason: z.string().nullable(),
});

export const lotReofferExpiredPayloadSchema = z.object({ ...reofferEventBase });

export const lotReofferWithdrawnPayloadSchema = z.object({
  ...reofferEventBase,
  reason: z.string(),
});

/** The lot was won again by the bidder who accepted, at the offered amount. */
export const lotReawardedPayloadSchema = z.object({
  ...reofferEventBase,
  reason: z.string(),
  newBuyerId: z.string(),
  newBuyerLegalEntityId: z.string().uuid(),
  previousBuyerId: z.string().nullable(),
  /** The hammer of the sale that failed, which stays on the buyer default. */
  originalHammerPence: z.number().int().nonnegative(),
});

export const lotSoftDeletedPayloadSchema = z.object({
  title: z.string(),
  from_status: z.string(),
  saleId: z.string().uuid().nullable(),
  deleted_at: z.string().datetime(),
});

/**
 * Staff recorded a seller's signed paper consignment agreement for a lot whose payout was held.
 * The audit entry keeps the commission, the signing date, the signed file and why it was recorded
 * by staff; a correction keeps the figures it replaced.
 */
export const lotSellerAgreementRecordedPayloadSchema = z.object({
  lotId: z.string().uuid(),
  submissionId: z.string().uuid(),
  agreementId: z.string().uuid(),
  sellerLegalEntityId: z.string().uuid(),
  commissionPercent: z.string(),
  signedAt: z.string().datetime(),
  signedDocumentId: z.string().uuid(),
  reason: z.string().min(1),
  replace: z.boolean(),
  previousAgreement: z
    .object({
      agreementId: z.string().uuid(),
      commissionPercent: z.string().nullable(),
      acceptedAt: z.string().datetime().nullable(),
      source: z.string(),
      signedDocumentId: z.string().uuid().nullable(),
    })
    .nullable(),
  /** The held sale the agreement released, and what its seller now receives. */
  releasedSellerTermsId: z.string().uuid().nullable(),
  sellerNetPence: z.number().int().nonnegative().nullable(),
});

export const LotEventSchemas = {
  "lot.created": lotCreatedPayloadSchema,
  "lot.activated": lotActivatedPayloadSchema,
  "lot.attached_to_sale": lotAttachedToSalePayloadSchema,
  "lot.detached_from_sale": lotDetachedFromSalePayloadSchema,
  "lot.published": lotPublishedPayloadSchema,
  "lot.unpublished": lotUnpublishedPayloadSchema,
  "lot.cancelled": lotCancelledPayloadSchema,
  "lot.ended": lotEndedPayloadSchema,
  "lot.voided": lotVoidedPayloadSchema,
  "lot.withdrawal_requested": lotWithdrawalRequestedPayloadSchema,
  "lot.withdrawal_declined": lotWithdrawalDeclinedPayloadSchema,
  "lot.returned_to_inventory": lotReturnedToInventoryPayloadSchema,
  "lot.buyer_defaulted": lotBuyerDefaultedPayloadSchema,
  "lot.reoffer_started": lotReofferStartedPayloadSchema,
  "lot.seller_consent_given": lotSellerConsentGivenPayloadSchema,
  "lot.seller_consent_refused": lotSellerConsentRefusedPayloadSchema,
  "lot.seller_consent_lapsed": lotSellerConsentLapsedPayloadSchema,
  "lot.reoffer_sent": lotReofferSentPayloadSchema,
  "lot.reoffer_accepted": lotReofferAcceptedPayloadSchema,
  "lot.reoffer_declined": lotReofferDeclinedPayloadSchema,
  "lot.reoffer_expired": lotReofferExpiredPayloadSchema,
  "lot.reoffer_withdrawn": lotReofferWithdrawnPayloadSchema,
  "lot.reawarded": lotReawardedPayloadSchema,
  "lot.soft_deleted": lotSoftDeletedPayloadSchema,
  "lot.seller_agreement_recorded": lotSellerAgreementRecordedPayloadSchema,
} as const;

export type LotEventType = keyof typeof LotEventSchemas;

export type LotEventPayload<T extends LotEventType> = z.infer<(typeof LotEventSchemas)[T]>;

export type LotCreatedPayload = z.infer<typeof lotCreatedPayloadSchema>;
export type LotAttachedToSalePayload = z.infer<typeof lotAttachedToSalePayloadSchema>;
export type LotDetachedFromSalePayload = z.infer<typeof lotDetachedFromSalePayloadSchema>;
export type LotCancelledPayload = z.infer<typeof lotCancelledPayloadSchema>;
export type LotEndedPayload = z.infer<typeof lotEndedPayloadSchema>;
export type LotReturnedToInventoryPayload = z.infer<typeof lotReturnedToInventoryPayloadSchema>;

export function parseLotEventPayload<T extends LotEventType>(
  eventType: T,
  payload: unknown,
): LotEventPayload<T> {
  return LotEventSchemas[eventType].parse(payload) as LotEventPayload<T>;
}
