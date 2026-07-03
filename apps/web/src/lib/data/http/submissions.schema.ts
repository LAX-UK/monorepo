import {
  zCoerceDate,
  zNullableStringFromEmpty,
  zOptionalStringFromEmpty,
  zStringArrayFromUnknown,
} from "@/lib/data/http/schema-coerce";
import type { ExhibitionEntry, ItemSubmission, ProvenanceEntry } from "@auction/types";
import { itemSubmissionStatuses } from "@auction/types";
import { z } from "zod";

const provenanceArraySchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(z.unknown()).transform((entries) => entries as ProvenanceEntry[]),
);

const exhibitionArraySchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(z.unknown()).transform((entries) => entries as ExhibitionEntry[]),
);

const itemSubmissionStatusSchema = z.preprocess((value) => {
  if (typeof value === "string" && (itemSubmissionStatuses as readonly string[]).includes(value)) {
    return value;
  }
  return "submitted";
}, z.enum(itemSubmissionStatuses));

const itemSubmissionRowSchema = z
  .object({
    id: z.unknown(),
    legalEntityId: z.unknown().optional(),
    sellerId: z.unknown().optional(),
    title: z.unknown(),
    description: z.unknown().optional(),
    medium: z.unknown().optional(),
    dimensions: z.unknown().optional(),
    images: z.unknown().optional(),
    yearOfWork: z.unknown().optional(),
    isSigned: z.unknown().optional(),
    signatureNote: z.unknown().optional(),
    edition: z.unknown().optional(),
    conditionSelfReport: z.unknown().optional(),
    provenance: z.unknown().optional(),
    exhibitions: z.unknown().optional(),
    askingPrice: z.unknown().optional(),
    reservePrice: z.unknown().optional(),
    categoryIds: z.unknown().optional(),
    categoryId: z.unknown().optional(),
    submitterNotes: z.unknown().optional(),
    status: z.unknown().optional(),
    reviewedBy: z.unknown().optional(),
    reviewedAt: z.unknown().optional(),
    reviewNotes: z.unknown().optional(),
    rejectionReason: z.unknown().optional(),
    convertedLotId: z.unknown().optional(),
    assignedToUserId: z.unknown().optional(),
    createdAt: z.unknown(),
    updatedAt: z.unknown(),
  })
  .transform((row): ItemSubmission => {
    const legalEntityId = zOptionalStringFromEmpty.parse(row.legalEntityId);
    const sellerId = zOptionalStringFromEmpty.parse(row.sellerId);

    return {
      id: String(row.id),
      ...(legalEntityId ? { legalEntityId } : {}),
      ...(sellerId ? { sellerId } : {}),
      title: String(row.title),
      description: zNullableStringFromEmpty.parse(row.description),
      medium: zNullableStringFromEmpty.parse(row.medium),
      dimensions: zNullableStringFromEmpty.parse(row.dimensions),
      images: zStringArrayFromUnknown.parse(row.images),
      yearOfWork: zNullableStringFromEmpty.parse(row.yearOfWork),
      isSigned: Boolean(row.isSigned),
      signatureNote: zNullableStringFromEmpty.parse(row.signatureNote),
      edition: zNullableStringFromEmpty.parse(row.edition),
      conditionSelfReport: zNullableStringFromEmpty.parse(row.conditionSelfReport),
      provenance: provenanceArraySchema.parse(row.provenance),
      exhibitions: exhibitionArraySchema.parse(row.exhibitions),
      askingPrice: zNullableStringFromEmpty.parse(row.askingPrice),
      reservePrice: zNullableStringFromEmpty.parse(row.reservePrice),
      categoryIds: zStringArrayFromUnknown.parse(row.categoryIds),
      categoryId: String(row.categoryId ?? ""),
      submitterNotes: zNullableStringFromEmpty.parse(row.submitterNotes),
      status: itemSubmissionStatusSchema.parse(row.status),
      reviewedBy: zNullableStringFromEmpty.parse(row.reviewedBy),
      reviewedAt:
        zNullableStringFromEmpty.parse(row.reviewedAt) == null
          ? null
          : zCoerceDate.parse(row.reviewedAt),
      reviewNotes: zNullableStringFromEmpty.parse(row.reviewNotes),
      rejectionReason: zNullableStringFromEmpty.parse(row.rejectionReason),
      convertedLotId: zNullableStringFromEmpty.parse(row.convertedLotId),
      assignedToUserId: zNullableStringFromEmpty.parse(row.assignedToUserId),
      createdAt: zCoerceDate.parse(row.createdAt),
      updatedAt: zCoerceDate.parse(row.updatedAt),
    };
  });

export const itemSubmissionSchema = itemSubmissionRowSchema as z.ZodType<ItemSubmission>;

export function parseItemSubmissionSchema(raw: unknown): ItemSubmission {
  return itemSubmissionSchema.parse(raw);
}

type _ItemSubmissionInfer = z.infer<typeof itemSubmissionSchema>;
const _itemSubmissionTypeGuard = null as unknown as _ItemSubmissionInfer satisfies ItemSubmission;
void _itemSubmissionTypeGuard;
