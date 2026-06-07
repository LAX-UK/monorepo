import type {
  ArtistKind,
  CreateItemSubmissionInput,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
  UpdateItemSubmissionInput,
  UserRole,
} from "@auction/types";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../../lib/errors.js";
import type { ListSubmissionsFilter } from "./repositories.js";

export type UpdateSubmissionActorInput = {
  actorId: string;
  role: string;
  /** Actor LAX staff role when `role` is administrator. */
  staffRole?: string | null;
  submissionId: string;
  /** Seller draft edits (validated with updateItemSubmissionSchema). */
  sellerPatch?: UpdateItemSubmissionInput | undefined;
  /** Admin notes only (validated with adminSubmissionNotesSchema). */
  adminNotes?: { reviewNotes?: string | undefined } | undefined;
};

/** Inline-create artist payload accepted on submission approval. Mirrors
 * `inlineCreateArtistSchema` in `@auction/validators`. */
export type ApproveSubmissionNewArtist = {
  displayName: string;
  kind?: ArtistKind | undefined;
  shortBio?: string | undefined;
  ownerUserId?: string | null | undefined;
};

/** Body shape for `IItemSubmissionService.approve`. Either pick an existing
 * artist via {@link artistId} or create one inline via {@link newArtist}. Both
 * may be omitted to leave the lot unattributed (admin attaches later). */
export type ApproveSubmissionInput = {
  reviewNotes?: string | undefined;
  artistId?: string | null | undefined;
  newArtist?: ApproveSubmissionNewArtist | undefined;
};

export interface IItemSubmissionService {
  createDraft(
    sellerId: string,
    input: CreateItemSubmissionInput,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  updateForActor(
    input: UpdateSubmissionActorInput,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  submitForReview(sellerId: string, id: string): Promise<Result<ItemSubmission, SubmissionError>>;
  withdraw(sellerId: string, id: string): Promise<Result<ItemSubmission, SubmissionError>>;
  listForSeller(sellerId: string, f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  getForSeller(sellerId: string, id: string): Promise<Result<ItemSubmission, SubmissionError>>;
  listForAdmin(f: ListSubmissionsFilter): Promise<ItemSubmission[]>;
  getForAdmin(id: string): Promise<Result<ItemSubmission, SubmissionError>>;
  countPendingForAdmin(f: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number>;
  startReview(adminId: string, id: string): Promise<Result<ItemSubmission, SubmissionError>>;
  assignForAdmin(
    adminId: string,
    id: string,
    assignedToUserId: string | null,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  accept(
    adminId: string,
    id: string,
    input?: Pick<ApproveSubmissionInput, "reviewNotes"> | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  convert(
    adminId: string,
    id: string,
    input?: ApproveSubmissionInput | undefined,
  ): Promise<
    Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
  >;
  approve(
    adminId: string,
    id: string,
    input?: ApproveSubmissionInput | undefined,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>>;
  reject(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>>;

  /** Public catalogue: list + image URL resolution. */
  listSubmissionsForSellerApi(
    legalEntityId: string,
    f: ListSubmissionsFilter,
  ): Promise<{ data: ItemSubmission[]; total: number }>;
  getSubmissionSummaryForSellerApi(
    legalEntityId: string,
  ): Promise<{ counts: Record<ItemSubmissionStatus, number>; total: number }>;
  listSubmissionsForAdminApi(
    f: ListSubmissionsFilter,
  ): Promise<{ data: ItemSubmission[]; total: number }>;
  getSubmissionForViewerApi(input: {
    submissionId: string;
    role: UserRole;
    staffRole?: string | null;
    sellerLegalEntityId: string;
  }): Promise<Result<ItemSubmission, SubmissionError>>;
  patchSubmissionFromRequestBody(input: {
    rawBody: unknown;
    submissionId: string;
    role: UserRole;
    staffRole?: string | null;
    userId: string;
    sellerLegalEntityId: string;
  }): Promise<
    | { kind: "ok"; data: ItemSubmission }
    | { kind: "bad_request"; details: unknown }
    | { kind: "err"; error: SubmissionError }
  >;
  bulkApproveOrReject(input: {
    adminId: string;
    ids: string[];
    op: "approve" | "reject";
    reason?: string | undefined;
    reviewNotes?: string | undefined;
  }): Promise<
    | { kind: "ok"; count: number }
    | { kind: "bad_request"; message: string }
    | { kind: "err"; error: SubmissionError }
  >;

  createDraftForSellerApi(
    legalEntityId: string,
    input: CreateItemSubmissionInput,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  submitForReviewForSellerApi(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  withdrawForSellerApi(
    legalEntityId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  startReviewForAdminApi(
    adminId: string,
    id: string,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  assignForAdminApi(
    adminId: string,
    id: string,
    assignedToUserId: string | null,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  countQualityGapsForAdminApi(): Promise<number>;
  countSubmissionsBySellersForAdminApi(sellerIds: readonly string[]): Promise<number>;
  sendStaleDraftReminders(input: {
    staleDays: number;
    batchLimit?: number;
  }): Promise<{ reminded: number }>;
  acceptForAdminApi(
    adminId: string,
    id: string,
    body: Pick<ApproveSubmissionInput, "reviewNotes">,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
  convertForAdminApi(
    adminId: string,
    id: string,
    body: ApproveSubmissionInput,
  ): Promise<
    Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
  >;
  approveForAdminApi(
    adminId: string,
    id: string,
    body: ApproveSubmissionInput,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>>;
  rejectForAdminApi(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
}
