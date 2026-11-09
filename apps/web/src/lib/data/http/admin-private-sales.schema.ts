import { DEAL_VIEWS } from "@auction/domain";
import { PRIVATE_SALE_DEAL_STAGES } from "@auction/types";
import { STAFF_DEAL_ACTIONS } from "@auction/validators";
import { z } from "zod";

/** What the staff Private sales routes answer with. Browser-safe: no server-only imports. */
const stage = z.enum(PRIVATE_SALE_DEAL_STAGES);
const role = z.enum(["seller", "buyer"]);

export const dealListItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  stage,
  workTitle: z.string(),
  workReference: z.string(),
  sellerName: z.string(),
  buyerName: z.string().nullable(),
  priceMinor: z.number().nullable(),
  ownerUserId: z.string().nullable(),
  offerExpiresAt: z.string().nullable(),
  paymentDueAt: z.string().nullable(),
  collectionDueAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type DealListItem = z.infer<typeof dealListItemSchema>;

export const dealListPageSchema = z.object({
  items: z.array(dealListItemSchema),
  nextCursor: z.string().nullable(),
  counts: z.record(z.enum(DEAL_VIEWS), z.number()),
});
export type DealListPage = z.infer<typeof dealListPageSchema>;

const blockerSchema = z.object({
  code: z.string(),
  message: z.string(),
  party: role.optional(),
});
export type DealBlocker = z.infer<typeof blockerSchema>;

const partySchema = z.object({
  role,
  legalEntityId: z.string(),
  displayName: z.string(),
  kyc: z.enum(["clear", "pending", "failed"]).nullable(),
  aml: z.enum(["clear", "pending", "review", "blocked"]).nullable(),
  accepted: z.boolean(),
});
export type DealParty = z.infer<typeof partySchema>;

const moneySchema = z.object({
  priceMinor: z.number(),
  buyerFeeMinor: z.number(),
  totalDueMinor: z.number(),
  sellerCommissionMinor: z.number().nullable(),
  costsMinor: z.number(),
  netToSellerMinor: z.number().nullable(),
});

export const TERM_KEYS = [
  "priceMinor",
  "buyerFeeBps",
  "sellerCommissionBps",
  "costsMinor",
  "vatTreatment",
  "partiesDisclosed",
  "offerExpiresAt",
] as const;
export type TermKey = (typeof TERM_KEYS)[number];

export const dealRecordSchema = z.object({
  reference: z.string(),
  stage,
  version: z.number(),
  work: z.object({ id: z.string(), title: z.string(), reference: z.string() }),
  sourceEnquiryReference: z.string().nullable(),
  ownerUserId: z.string().nullable(),
  priceMinor: z.number().nullable(),
  buyerFeeBps: z.number(),
  sellerCommissionBps: z.number().nullable(),
  costsMinor: z.number(),
  vatTreatment: z.string().nullable(),
  partiesDisclosed: z.boolean(),
  offerExpiresAt: z.string().nullable(),
  paymentDueAt: z.string().nullable(),
  collectionDueAt: z.string().nullable(),
  agreedAt: z.string().nullable(),
  invoiceReference: z.string().nullable(),
  cancelReason: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  money: moneySchema.nullable(),
  seller: partySchema,
  buyer: partySchema.nullable(),
  /** `null` for people who may not see how the checks stand. */
  sourceOfFunds: z
    .object({
      status: z.enum(["approved", "pending", "declined", "not_requested"]),
      required: z.boolean(),
      thresholdMinor: z.number(),
    })
    .nullable(),
  documents: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      version: z.string().nullable(),
      acceptedAt: z.string().nullable(),
      legalEntityId: z.string().nullable(),
      audience: z.string(),
    }),
  ),
  payment: z
    .object({
      status: z.string(),
      rail: z.string(),
      amountMinor: z.number(),
      paidAt: z.string().nullable(),
      refundedMinor: z.number(),
      recordedTransfer: z.boolean(),
    })
    .nullable(),
  timeline: z.array(
    z.object({
      fromStage: stage.nullable(),
      toStage: stage,
      reason: z.string().nullable(),
      createdAt: z.string(),
      actorName: z.string().nullable(),
    }),
  ),
  policy: z.object({
    gaps: z.array(
      z.enum(["terms_version", "commission_rate", "vat_treatments", "payment_due_days"]),
    ),
    termsVersion: z.string().nullable(),
    vatTreatments: z.array(z.object({ code: z.string(), label: z.string() })),
  }),
  editableTerms: z.array(z.enum(TERM_KEYS)),
  canNameBuyer: z.boolean(),
  actions: z.array(
    z.object({ action: z.enum(STAFF_DEAL_ACTIONS), blockers: z.array(blockerSchema) }),
  ),
});
export type DealRecord = z.infer<typeof dealRecordSchema>;

/** A refused write: the code, and what the API said about it. */
export const dealRefusalSchema = z.object({
  error: z.string(),
  fields: z.array(z.string()).optional(),
  blockers: z.array(blockerSchema).optional(),
  currentVersion: z.number().optional(),
});
export type DealRefusal = z.infer<typeof dealRefusalSchema>;

export const convertedDealSchema = z.object({ reference: z.string() });
