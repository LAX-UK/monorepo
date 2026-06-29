import { legalEntityKinds, legalEntityStatuses } from "@auction/types";
import { z } from "zod";

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const userBidsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const impersonationStartBodySchema = z.object({
  legalEntityId: z.string().uuid(),
});

export const impersonationLookupQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
});

export const adminLegalEntityBrowseQuerySchema = z.object({
  q: z.string().max(200).optional(),
  createdByUserId: z.string().uuid().optional(),
  status: z.enum(legalEntityStatuses).optional(),
  kind: z.enum(legalEntityKinds).optional(),
  stripeDue: z.enum(["0", "1"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export const impersonationRecordFailedEndBodySchema = z.object({
  sessionId: z.string().uuid(),
  legalEntityId: z.string().uuid(),
});

export const adminPaymentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const amlScreeningIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const amlReviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const sourceOfFundsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(["pending", "rejected", "approved"]).optional().default("pending"),
});

export const amlReviewBodySchema = z.object({
  decision: z.enum(["clear", "block"]),
  notes: z.string().max(2000).optional(),
});

export const amlTriageBodySchema = z.object({
  recommendation: z.enum(["clear", "block"]),
  notes: z.string().max(2000).optional(),
});

export const sourceOfFundsIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const sourceOfFundsReviewBodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

export const sourceOfFundsTriageBodySchema = z.object({
  recommendation: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

export const sourceOfFundsRequestDocumentsBodySchema = z.object({
  documentTypes: z.array(z.string().min(1).max(500)).min(1).max(20),
  note: z.string().max(2000).optional(),
});

export const sourceOfFundsDocumentIdParamSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
});

export const sourceOfFundsDocumentReviewBodySchema = z.object({
  checks: z.object({
    matchesDeclaredSource: z.boolean().optional(),
    coversExposure: z.boolean().optional(),
    recentEnough: z.boolean().optional(),
    legibleComplete: z.boolean().optional(),
  }),
  note: z.string().max(2000).optional(),
});

export const adminUserIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const adminArtistSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
