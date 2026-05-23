import { itemSubmissionStatuses } from "@auction/types";
import { z } from "zod";
import { inlineCreateArtistSchema } from "./artist.js";
import { mediaReferenceSchema } from "./media.js";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

const decimalRegex = /^\d+(\.\d{1,2})?$/;
const categoryIdsSchema = z
  .array(z.string().uuid())
  .min(1, "Choose at least one category")
  .max(8, "Choose no more than 8 categories");

function normalizeCategoryIdsInput(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.categoryIds)) return raw;
  if (typeof record.categoryId === "string" && record.categoryId.length > 0) {
    return { ...record, categoryIds: [record.categoryId] };
  }
  return raw;
}

const provenanceEntrySchema = z.object({
  period: z.string().max(120).optional(),
  note: z.string().min(1).max(500),
});

const exhibitionEntrySchema = z.object({
  year: z.string().max(20).optional(),
  venue: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
});

/** Split pasted image URL lines (newlines or commas). */
export function splitSubmissionUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** RHF form: text fields + uploaded image URLs. Validates then maps to `createItemSubmissionSchema` input.
 */
export const itemSubmissionFormSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(500),
    description: z.string().max(10_000),
    medium: z.string().max(500),
    dimensions: z.string().max(200),
    categoryIds: categoryIdsSchema,
    images: z.array(mediaReferenceSchema).max(20),
    yearOfWork: z.string().max(60),
    isSigned: z.boolean(),
    signatureNote: z.string().max(500),
    edition: z.string().max(60),
    conditionSelfReport: z.string().max(5000),
    provenance: z.array(provenanceEntrySchema).max(20),
    exhibitions: z.array(exhibitionEntrySchema).max(20),
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

const createItemSubmissionBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  medium: z.string().max(500).optional(),
  dimensions: z.string().max(200).optional(),
  images: z.array(mediaReferenceSchema).max(20).optional(),
  yearOfWork: z.string().max(60).optional(),
  isSigned: z.boolean().optional(),
  signatureNote: z.string().max(500).optional(),
  edition: z.string().max(60).optional(),
  conditionSelfReport: z.string().max(5000).optional(),
  provenance: z.array(provenanceEntrySchema).max(20).optional(),
  exhibitions: z.array(exhibitionEntrySchema).max(20).optional(),
  askingPrice: decimalString.optional(),
  reservePrice: decimalString.optional(),
  categoryIds: categoryIdsSchema,
  categoryId: z.string().uuid().optional(),
  submitterNotes: z.string().max(5000).optional(),
});

export const createItemSubmissionSchema = z.preprocess(
  normalizeCategoryIdsInput,
  createItemSubmissionBodySchema,
);

export const updateItemSubmissionSchema = z.preprocess(
  normalizeCategoryIdsInput,
  createItemSubmissionBodySchema.partial(),
);

export const approveSubmissionBodySchema = z
  .object({
    reviewNotes: z.string().max(5000).optional(),
    artistId: z.string().uuid().nullable().optional(),
    newArtist: inlineCreateArtistSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.artistId && data.newArtist) {
      ctx.addIssue({
        code: "custom",
        message: "Provide either artistId or newArtist, not both",
        path: ["newArtist"],
      });
    }
  });

export type ApproveSubmissionBody = z.infer<typeof approveSubmissionBodySchema>;

export const rejectSubmissionBodySchema = z.object({
  rejectionReason: z.string().trim().min(1, "Rejection reason is required").max(2000),
  reviewNotes: z.string().max(5000).optional(),
});

export const submissionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const submissionDecisionQueueSchema = z.enum(["awaiting", "accepted", "rejected"]);

export const listSubmissionsQuerySchema = z.object({
  /** Admin decision-queue tab: filters multiple underlying statuses server-side. */
  queue: submissionDecisionQueueSchema.optional(),
  status: z.enum(itemSubmissionStatuses).optional(),
  sellerId: z.string().min(1).max(191).optional(),
  q: z.string().trim().max(200).optional(),
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

export const adminBulkSubmissionsBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(25),
  op: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
  reviewNotes: z.string().max(5000).optional(),
});
