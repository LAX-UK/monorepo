import { itemSubmissionStatuses } from "@auction/types";
import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

export const createItemSubmissionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  medium: z.string().max(500).optional(),
  dimensions: z.string().max(200).optional(),
  images: z.array(z.string().url()).max(20).optional(),
  askingPrice: decimalString.optional(),
  reservePrice: decimalString.optional(),
  categoryId: z.string().uuid(),
  submitterNotes: z.string().max(5000).optional(),
});

export const updateItemSubmissionSchema = createItemSubmissionSchema.partial();

export const approveSubmissionBodySchema = z.object({
  reviewNotes: z.string().max(5000).optional(),
});

export const rejectSubmissionBodySchema = z.object({
  rejectionReason: z.string().min(1).max(2000),
  reviewNotes: z.string().max(5000).optional(),
});

export const submissionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listSubmissionsQuerySchema = z.object({
  status: z.enum(itemSubmissionStatuses).optional(),
  sellerId: z.string().min(1).max(191).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export const adminSubmissionCountQuerySchema = z.object({
  status: z.enum(itemSubmissionStatuses).optional().default("submitted"),
});

/** Admin-only: optional notes on a submission under review. */
export const adminSubmissionNotesSchema = z.object({
  reviewNotes: z.string().max(5000).optional(),
});
