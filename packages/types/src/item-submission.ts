export const itemSubmissionStatuses = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
  "converted",
] as const;

export type ItemSubmissionStatus = (typeof itemSubmissionStatuses)[number];

export type ProvenanceEntry = { period?: string | undefined; note: string };
export type ExhibitionEntry = {
  year?: string | undefined;
  venue: string;
  note?: string | undefined;
};

export type ItemSubmission = {
  id: string;
  /** Transitional compatibility only; new API mappers do not emit this field. */
  sellerId?: string;
  legalEntityId?: string | undefined;
  title: string;
  description: string | null;
  medium: string | null;
  dimensions: string | null;
  images: string[];
  yearOfWork?: string | null;
  isSigned?: boolean;
  signatureNote?: string | null;
  edition?: string | null;
  conditionSelfReport?: string | null;
  provenance?: ProvenanceEntry[];
  exhibitions?: ExhibitionEntry[];
  askingPrice: string | null;
  reservePrice: string | null;
  categoryIds?: string[];
  /** @deprecated Use categoryIds[0] while legacy web surfaces are migrated. */
  categoryId: string;
  submitterNotes: string | null;
  status: ItemSubmissionStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  convertedLotId: string | null;
  assignedToUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateItemSubmissionInput = {
  title: string;
  description?: string | undefined;
  medium?: string | undefined;
  dimensions?: string | undefined;
  images?: string[] | undefined;
  yearOfWork?: string | undefined;
  isSigned?: boolean | undefined;
  signatureNote?: string | undefined;
  edition?: string | undefined;
  conditionSelfReport?: string | undefined;
  provenance?: ProvenanceEntry[] | undefined;
  exhibitions?: ExhibitionEntry[] | undefined;
  askingPrice?: string | undefined;
  reservePrice?: string | undefined;
  categoryIds?: string[];
  /** @deprecated Prefer categoryIds. Accepted during the migration window. */
  categoryId?: string | undefined;
  submitterNotes?: string | undefined;
  legalEntityId?: string | undefined;
};

export type UpdateItemSubmissionInput = Partial<CreateItemSubmissionInput>;
