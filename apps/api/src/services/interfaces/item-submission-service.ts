import type {
  ArtistKind,
  CreateItemSubmissionInput,
  ItemSubmission,
  Lot,
  UpdateItemSubmissionInput,
} from "@auction/types";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../../lib/errors.js";
import type { ListSubmissionsFilter } from "./repositories.js";

export type UpdateSubmissionActorInput = {
  actorId: string;
  role: string;
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
}
