import { lotDocumentKinds, saleDocumentKinds, submissionDocumentKinds } from "@auction/types";
import { z } from "zod";

export const attachEntityDocumentSchema = z.object({
  uploadObjectId: z.string().uuid(),
  kind: z.string().min(1).max(64),
  label: z.string().max(200).nullable().optional(),
});

export type AttachEntityDocumentInput = z.infer<typeof attachEntityDocumentSchema>;

export const attachLotDocumentBodySchema = attachEntityDocumentSchema.extend({
  kind: z.enum(lotDocumentKinds),
});

export const attachSaleDocumentBodySchema = attachEntityDocumentSchema.extend({
  kind: z.enum(saleDocumentKinds),
});

export const attachSubmissionDocumentBodySchema = attachEntityDocumentSchema.extend({
  kind: z.enum(submissionDocumentKinds),
});

export const lotDocumentsLotIdParamSchema = z.object({
  lotId: z.string().uuid(),
});

export const saleDocumentsSaleIdParamSchema = z.object({
  saleId: z.string().uuid(),
});

export const submissionDocumentsSubmissionIdParamSchema = z.object({
  submissionId: z.string().uuid(),
});

export const entityDocumentIdParamSchema = z.object({
  documentId: z.string().uuid(),
});
