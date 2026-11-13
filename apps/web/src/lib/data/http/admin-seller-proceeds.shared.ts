import { z } from "zod";

/**
 * The seller's side of sales as the API stores it, for staff screens. Every figure is in whole
 * pence as the snapshot, the payout line or the calculator wrote it; dates stay ISO strings so a
 * server page can hand them to client components. Nothing here works a figure out.
 */

const heldReasonSchema = z.enum([
  "no_agreement",
  "not_accepted",
  "no_commission",
  "other_seller",
  "vat_setting_missing",
  "negative_net",
  "legacy_invoice",
]);
export type SellerHeldReason = z.infer<typeof heldReasonSchema>;

const vatTreatmentSchema = z.enum(["standard", "not_registered"]);
export type SellerVatTreatment = z.infer<typeof vatTreatmentSchema>;

const isoDate = z.string();
const pence = z.number().int();

const agreementSchema = z.object({
  id: z.string().optional(),
  reference: z.string(),
  submissionId: z.string(),
  signedAt: isoDate.nullable(),
  source: z.enum(["online", "recorded"]),
  legalEntityId: z.string().optional(),
  commissionPercent: z.string().nullable().optional(),
});
export type SellerAgreementRef = z.infer<typeof agreementSchema>;

const termsSchema = z.object({
  id: z.string(),
  basis: z.enum(["agreement", "lax_owned", "held"]),
  heldReason: heldReasonSchema.nullable(),
  source: z.enum(["raised", "recomputed_at_payout", "agreement_recorded"]),
  hammerPence: pence,
  premiumPence: pence,
  commissionBps: pence.nullable(),
  commissionPence: pence.nullable(),
  commissionVatTreatment: vatTreatmentSchema.nullable(),
  commissionVatBps: pence.nullable(),
  commissionVatPence: pence.nullable(),
  sellerNetPence: pence.nullable(),
  legacyPlatformFeePence: pence.nullable(),
  computedAt: isoDate,
});
export type SellerTermsDto = z.infer<typeof termsSchema>;

export const lotSellerProceedsSchema = z.object({
  lotId: z.string(),
  lotNumber: z.number().int().nullable(),
  lotTitle: z.string(),
  sellerLegalEntityId: z.string().nullable(),
  sellerName: z.string().nullable(),
  soldOnAtg: z.boolean(),
  settledOutsideAt: isoDate.nullable().optional().default(null),
  sale: z
    .object({
      paymentId: z.string(),
      paymentStatus: z.string(),
      terms: termsSchema.nullable(),
      invoice: z
        .object({
          totalPence: pence,
          premiumPence: pence,
          premiumRatePercent: z.string().nullable(),
        })
        .nullable(),
      payout: z
        .object({ id: z.string(), status: z.string(), processedAt: isoDate.nullable() })
        .nullable(),
      refundedAfterPayout: z.boolean(),
      reawarded: z.boolean(),
    })
    .nullable(),
  agreement: agreementSchema.nullable(),
  submissionId: z.string().nullable(),
  vatSetting: vatTreatmentSchema.nullable(),
});
export type LotSellerProceedsDto = z.infer<typeof lotSellerProceedsSchema>;

const saleLabelSchema = {
  lotNumber: z.number().int().nullable(),
  lotTitle: z.string().nullable(),
  agreement: agreementSchema.nullable(),
};

export const settlementPreviewSaleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ready"),
    paymentId: z.string(),
    lotId: z.string(),
    ...saleLabelSchema,
    hammerPence: pence,
    commissionBps: pence,
    commissionPence: pence,
    commissionVatTreatment: vatTreatmentSchema,
    commissionVatBps: pence,
    commissionVatPence: pence,
    refundChargePence: pence,
    netPence: pence,
  }),
  z.object({
    kind: z.literal("held"),
    paymentId: z.string(),
    lotId: z.string().nullable(),
    ...saleLabelSchema,
    reason: heldReasonSchema,
    hammerPence: pence.nullable(),
  }),
]);
export type SettlementPreviewSaleDto = z.infer<typeof settlementPreviewSaleSchema>;

/** A released private-sale deal the run would pay, split as the run splits it. */
export const settlementPreviewDealSchema = z.object({
  dealId: z.string(),
  reference: z.string(),
  pricePence: pence,
  commissionPence: pence,
  costsPence: pence,
  netPence: pence,
});
export type SettlementPreviewDealDto = z.infer<typeof settlementPreviewDealSchema>;

/** The API's totals: the ready sales and the deals added up there, never again on screen. */
export const settlementPreviewTotalsSchema = z.object({
  hammerPence: pence,
  commissionPence: pence,
  commissionVatPence: pence,
  refundChargePence: pence,
  dealsNetPence: pence.optional().default(0),
  netPence: pence,
});
export type SettlementPreviewTotalsDto = z.infer<typeof settlementPreviewTotalsSchema>;

const lineAgreementSchema = z.object({
  reference: z.string(),
  submissionId: z.string(),
  signedAt: isoDate.nullable(),
  source: z.enum(["online", "recorded"]),
  commissionPercent: z.string().nullable(),
});

const heldSaleSchema = z.object({
  paymentId: z.string(),
  sellerLegalEntityId: z.string(),
  sellerName: z.string().nullable(),
  lotId: z.string(),
  lotNumber: z.number().int().nullable(),
  lotTitle: z.string(),
  heldReason: heldReasonSchema,
  hammerPence: pence,
});
export type HeldSaleDto = z.infer<typeof heldSaleSchema>;
export const heldSalesSchema = z.array(heldSaleSchema);

export const payoutSalesSchema = z.object({
  payout: z.object({
    id: z.string(),
    legalEntityId: z.string(),
    status: z.string(),
    createdAt: isoDate,
    processedAt: isoDate.nullable(),
    grossAmount: z.string(),
    platformFee: z.string(),
    stripeFee: z.string(),
    netAmount: z.string(),
    hammerAmount: z.string().nullable(),
    commissionAmount: z.string().nullable(),
    commissionVatAmount: z.string().nullable(),
  }),
  sales: z.array(
    z.object({
      lineId: z.string(),
      paymentId: z.string(),
      lotId: z.string(),
      lotNumber: z.number().int().nullable(),
      lotTitle: z.string(),
      amount: z.string(),
      terms: z
        .object({
          hammerPence: pence,
          commissionBps: pence,
          commissionPence: pence,
          commissionVatTreatment: vatTreatmentSchema,
          commissionVatBps: pence,
          commissionVatPence: pence,
          sellerNetPence: pence,
        })
        .nullable(),
      oldRule: z.object({ paymentAmount: z.string(), platformFee: z.string() }).nullable(),
      agreement: lineAgreementSchema.nullable(),
    }),
  ),
  heldForSeller: heldSalesSchema,
});
export type PayoutSalesDto = z.infer<typeof payoutSalesSchema>;

export const oldRuleRowSchema = z.object({
  lineId: z.string(),
  payoutId: z.string(),
  payoutCreatedAt: isoDate,
  paidAt: isoDate.nullable(),
  legalEntityId: z.string(),
  sellerName: z.string().nullable(),
  lotId: z.string(),
  lotNumber: z.number().int().nullable(),
  lotTitle: z.string(),
  paymentAmount: z.string(),
  platformFee: z.string(),
  hammerPence: pence.nullable(),
  agreement: lineAgreementSchema.nullable(),
  paidNetPence: pence,
  agreementGives: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("priced"),
      commissionBps: pence,
      commissionPence: pence,
      commissionVatPence: pence,
      netPence: pence,
    }),
    z.object({
      kind: z.literal("unpriced"),
      reason: z.enum([
        "no_hammer",
        "no_agreement",
        "no_commission",
        "vat_setting_missing",
        "negative_net",
      ]),
    }),
  ]),
  differencePence: pence.nullable(),
});
export type OldRuleRowDto = z.infer<typeof oldRuleRowSchema>;

export const oldRulePageSchema = z.object({
  data: z.array(oldRuleRowSchema),
  meta: z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
});
export type OldRulePageDto = z.infer<typeof oldRulePageSchema>;
