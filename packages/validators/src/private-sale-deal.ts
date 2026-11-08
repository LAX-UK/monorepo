import { DEAL_VIEWS } from "@auction/domain";
import { z } from "zod";

/** The reference staff and clients quote: PS-0012. */
export const privateSaleReferenceSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^PS-\d{4,9}$/, "Use a reference like PS-0012");

export const privateSaleRefParamSchema = z.object({ ref: privateSaleReferenceSchema });

/** The moves staff may make on a deal from the record. `clear` re-checks the parties. */
export const STAFF_DEAL_ACTIONS = [
  "open_offer",
  "agree",
  "clear",
  "issue_invoice",
  "release",
  "cancel",
  "refund",
] as const;
export type StaffDealAction = (typeof STAFF_DEAL_ACTIONS)[number];

export const privateSaleActionParamSchema = z.object({
  ref: privateSaleReferenceSchema,
  action: z.enum(STAFF_DEAL_ACTIONS),
});

export const adminDealListQuerySchema = z.object({
  view: z.enum(DEAL_VIEWS).default("active"),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminDealListQuery = z.infer<typeof adminDealListQuerySchema>;

/** The terms staff may change. Which of them, and when, is decided by the deal's stage and the person's role. */
export const adminDealTermsSchema = z
  .object({
    priceMinor: z.number().int().min(1).max(1_000_000_000_00).nullable().optional(),
    buyerFeeBps: z.number().int().min(0).max(10_000).optional(),
    sellerCommissionBps: z.number().int().min(0).max(10_000).nullable().optional(),
    costsMinor: z.number().int().min(0).max(1_000_000_000_00).optional(),
    vatTreatment: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/)
      .max(60)
      .nullable()
      .optional(),
    partiesDisclosed: z.boolean().optional(),
    offerExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();
export type AdminDealTerms = z.infer<typeof adminDealTermsSchema>;

/** A change to a deal's terms, made against the version the person was looking at. */
export const adminDealTermsPatchSchema = z.object({
  version: z.number().int().min(1),
  terms: adminDealTermsSchema.refine((terms) => Object.keys(terms).length > 0, {
    message: "Nothing to change",
  }),
});
export type AdminDealTermsPatch = z.infer<typeof adminDealTermsPatchSchema>;

/** Name the buyer: the person who acts for them and, for an organisation, which one. */
export const adminDealBuyerSchema = z.object({
  version: z.number().int().min(1),
  buyerUserId: z.string().trim().min(1).max(100),
  legalEntityId: z.string().uuid().optional(),
});
export type AdminDealBuyerInput = z.infer<typeof adminDealBuyerSchema>;

/** A move on a deal. A reason is needed to cancel, and is ignored by the other moves. */
export const adminDealActionSchema = z.object({
  /** The version the person was looking at. */
  version: z.number().int().min(1),
  reason: z.string().trim().min(1).max(1000).optional(),
});
export type AdminDealActionInput = z.infer<typeof adminDealActionSchema>;

/**
 * Turn an enquiry into a deal. A sell enquiry names its own work; a buy enquiry names the work
 * the buyer is being offered, by its consignment reference (C-1042).
 */
export const adminDealConvertSchema = z.object({
  workReference: z
    .string()
    .trim()
    .regex(/^C-?\d{1,15}$/i, "Use a reference like C-1042")
    .optional(),
});
export type AdminDealConvertInput = z.infer<typeof adminDealConvertSchema>;
