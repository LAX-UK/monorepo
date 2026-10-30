export const itemSubmissionStatuses = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "changes_requested",
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
  imageAssets?: import("./gallery.js").GalleryImage[];
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
  /** What the specialist asked the seller to change, kept after resubmission for the record. */
  changesRequestedNote?: string | null;
  changesRequestedAt?: Date | null;
  /** When staff last reminded the seller to verify their identity. */
  identityReminderSentAt?: Date | null;
  convertedLotId: string | null;
  assignedToUserId?: string | null;
  /** The member who created or last sent it; `null` for submissions from before it was recorded. */
  submittedByUserId?: string | null;
  /** The reference the seller quotes to a specialist, for example "C-1042". */
  reference?: string;
  /** The member who sent it, named, for an organisation's list ("sent by Lena Fischer"). */
  sentBy?: { userId: string; name: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateItemSubmissionInput = {
  title: string;
  /** The person creating it, recorded so an organisation can show consignors their own. */
  submittedByUserId?: string | null | undefined;
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
