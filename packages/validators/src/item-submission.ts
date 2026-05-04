import { itemSubmissionStatuses } from "@auction/types";
import { z } from "zod";
import { mediaReferenceSchema } from "./media.js";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

const decimalRegex = /^\d+(\.\d{1,2})?$/;

/** Split pasted image URL lines (newlines or commas). */
export function splitSubmissionUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * RHF form: text fields + uploaded image URLs. Validates then maps to `createItemSubmissionSchema` input.
 */
export const itemSubmissionFormSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().max(10_000),
    medium: z.string().max(500),
    dimensions: z.string().max(200),
    categoryId: z.string().uuid({ message: "Choose a category" }),
    images: z.array(mediaReferenceSchema).max(20),
    askingPrice: z.string(),
    reservePrice: z.string(),
    submitterNotes: z.string().max(5000),
  })
  .superRefine((data, ctx) => {
    const ap = data.askingPrice.trim();
    if (ap && !decimalRegex.test(ap)) {
      ctx.addIssue({
        code: "custom",
        message: "Must be a valid decimal (e.g. 1200 or 1200.50)",
        path: ["askingPrice"],
      });
    }
    const rp = data.reservePrice.trim();
    if (rp && !decimalRegex.test(rp)) {
      ctx.addIssue({
        code: "custom",
        message: "Must be a valid decimal (e.g. 1200 or 1200.50)",
        path: ["reservePrice"],
      });
    }
  });

export type ItemSubmissionFormValues = z.infer<typeof itemSubmissionFormSchema>;

/** URL-driven filter on the seller submissions list (client + server parse). */
export const submissionListFilterSchema = z.object({
  status: z.union([z.literal("all"), z.enum(itemSubmissionStatuses)]),
  q: z.string().max(200),
});

export type SubmissionListFilterValues = z.infer<typeof submissionListFilterSchema>;

export const createItemSubmissionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  medium: z.string().max(500).optional(),
  dimensions: z.string().max(200).optional(),
  images: z.array(mediaReferenceSchema).max(20).optional(),
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
