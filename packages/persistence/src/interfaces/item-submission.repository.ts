import type {
  CreateItemSubmissionInput,
  ItemSubmission,
  ItemSubmissionStatus,
} from "@auction/types";

export type ListSubmissionsFilter = {
  status?: ItemSubmissionStatus | undefined;
  /** Multiple statuses (admin decision queues). Overrides `status` when set. */
  statuses?: ItemSubmissionStatus[] | undefined;
  legalEntityId?: string | undefined;
  categoryId?: string | undefined;
  q?: string | undefined;
  /** When true, only rows with quality warnings or missing required fields. */
  qualityGaps?: boolean | undefined;
  /** Admin: filter rows assigned to this staff user id. */
  assignedToUserId?: string | undefined;
  /** Admin list ordering. */
  sort?: "newest" | "oldest" | "sla" | undefined;
  limit: number;
  offset: number;
};

export type ItemSubmissionUpdatePatch = {
  title?: string;
  description?: string | null;
  medium?: string | null;
  dimensions?: string | null;
  images?: string[];
  yearOfWork?: string | null;
  isSigned?: boolean;
  signatureNote?: string | null;
  edition?: string | null;
  conditionSelfReport?: string | null;
  provenance?: { period?: string | undefined; note: string }[];
  exhibitions?: { year?: string | undefined; venue: string; note?: string | undefined }[];
  askingPrice?: string | null;
  reservePrice?: string | null;
  categoryId?: string;
  categoryIds?: string[];
  submitterNotes?: string | null;
  status?: ItemSubmissionStatus;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  convertedLotId?: string | null;
  assignedToUserId?: string | null;
  draftReminderSentAt?: Date | null;
};

export interface IItemSubmissionRepository {
  findById(id: string): Promise<ItemSubmission | null>;
  create(input: CreateItemSubmissionInput): Promise<ItemSubmission>;
  update(id: string, patch: ItemSubmissionUpdatePatch): Promise<ItemSubmission>;
  listForLegalEntity(legalEntityId: string, f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  countForLegalEntity(
    legalEntityId: string,
    f: Omit<ListSubmissionsFilter, "limit" | "offset">,
  ): Promise<number>;
  countStatusForLegalEntity(legalEntityId: string): Promise<Record<ItemSubmissionStatus, number>>;
  listForAdmin(f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  countAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number>;
  countAdminForLegalEntityIds(legalEntityIds: readonly string[]): Promise<number>;
  listStaleDraftsWithoutReminder(cutoff: Date, limit: number): Promise<ItemSubmission[]>;
}
