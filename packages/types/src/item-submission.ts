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

export type ItemSubmission = {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  medium: string | null;
  dimensions: string | null;
  images: string[];
  askingPrice: string | null;
  reservePrice: string | null;
  categoryId: string;
  submitterNotes: string | null;
  status: ItemSubmissionStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  convertedLotId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateItemSubmissionInput = {
  title: string;
  description?: string | undefined;
  medium?: string | undefined;
  dimensions?: string | undefined;
  images?: string[] | undefined;
  askingPrice?: string | undefined;
  reservePrice?: string | undefined;
  categoryId: string;
  submitterNotes?: string | undefined;
};

export type UpdateItemSubmissionInput = Partial<CreateItemSubmissionInput>;
