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
  /** Seller lists: which senders' submissions the viewer may see (see `/domain`). */
  visibleTo?: SubmissionSenderFilter | undefined;
  limit: number;
  offset: number;
};

/**
 * Whose submissions a seller list includes: every one, those with a recorded sender (any member),
 * or only the viewer's own.
 */
export type SubmissionSenderFilter = {
  scope: "all" | "attributed" | "own";
  userId: string;
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
  changesRequestedNote?: string | null;
  changesRequestedAt?: Date | null;
  convertedLotId?: string | null;
  assignedToUserId?: string | null;
  submittedByUserId?: string | null;
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
  countStatusForLegalEntity(
    legalEntityId: string,
    visibleTo?: SubmissionSenderFilter,
  ): Promise<Record<ItemSubmissionStatus, number>>;
  listForAdmin(f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  countAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number>;
  countAdminForLegalEntityIds(legalEntityIds: readonly string[]): Promise<number>;
  listStaleDraftsWithoutReminder(cutoff: Date, limit: number): Promise<ItemSubmission[]>;
  countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
}
