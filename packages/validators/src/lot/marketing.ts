import { z } from "zod";

/** Pre-sale estimate (subset of `LotMarketingDetails.estimate`). */
export const lotEstimateSchema = z.object({
  low: z.string().min(1).max(32),
  high: z.string().min(1).max(32),
  currency: z.string().min(1).max(8),
});

export type LotEstimateInput = z.infer<typeof lotEstimateSchema>;

/** Marketing / catalog copy (subset of `LotMarketingDetails`). */
export const conditionReportSchema = z.object({
  summary: z.string().max(5000).optional(),
  details: z.string().max(10_000).optional(),
  downloadUrl: z.string().url().max(2048).optional(),
});

export const provenanceEntrySchema = z.object({
  period: z.string().max(120).optional(),
  note: z.string().min(1).max(500),
});

export const exhibitionEntrySchema = z.object({
  year: z.string().max(20).optional(),
  venue: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
});

/** Catalog-copy patch on a lot. Artist attribution is `lot.artist_id` only;
 * marketing PATCH does not accept artist fields. */
export const updateLotMarketingDetailsSchema = z.object({
  estimate: lotEstimateSchema.nullable().optional(),
  conditionReport: conditionReportSchema.nullable().optional(),
  provenance: z.array(provenanceEntrySchema).max(50).nullable().optional(),
  exhibitions: z.array(exhibitionEntrySchema).max(50).nullable().optional(),
  imageAlts: z.array(z.string().max(500)).max(50).nullable().optional(),
  artistNote: z.string().max(5000).nullable().optional(),
});

export type UpdateLotMarketingDetailsInput = z.infer<typeof updateLotMarketingDetailsSchema>;

export const CONDITION_REPORT_REQUEST_NOTE_MAX = 2000;

export const conditionReportRequestFormSchema = z.object({
  requestNote: z
    .string()
    .max(
      CONDITION_REPORT_REQUEST_NOTE_MAX,
      `Note must be ${CONDITION_REPORT_REQUEST_NOTE_MAX} characters or fewer`,
    )
    .transform((s) => s.trim()),
});

export type ConditionReportRequestFormValues = z.infer<typeof conditionReportRequestFormSchema>;

export const createConditionReportRequestBodySchema = z.object({
  requestNote: z.string().max(CONDITION_REPORT_REQUEST_NOTE_MAX).optional(),
  requestingLegalEntityId: z.string().uuid().optional(),
});

export type CreateConditionReportRequestBody = z.infer<
  typeof createConditionReportRequestBodySchema
>;

export const listMyConditionReportRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListMyConditionReportRequestsQuery = z.infer<
  typeof listMyConditionReportRequestsQuerySchema
>;

export const fulfillConditionReportRequestBodySchema = z.object({
  conditionReport: conditionReportSchema.refine(
    (c) =>
      Boolean(
        (c.summary && c.summary.trim().length > 0) ||
          (c.details && c.details.trim().length > 0) ||
          c.downloadUrl,
      ),
    { message: "Provide summary, details, or a download URL" },
  ),
  responseNote: z.string().max(2000).optional(),
  responseAttachmentUploadId: z.string().uuid().optional(),
});

export type FulfillConditionReportRequestBody = z.infer<
  typeof fulfillConditionReportRequestBodySchema
>;

export const declineConditionReportRequestBodySchema = z.object({
  responseNote: z.string().max(2000).optional(),
});

export const conditionReportRequestIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const adminConditionReportListQuerySchema = z.object({
  status: z.enum(["open", "pending", "in_progress", "fulfilled", "declined"]).optional(),
  lotId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type AdminConditionReportListQuery = z.infer<typeof adminConditionReportListQuerySchema>;
