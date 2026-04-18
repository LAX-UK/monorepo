import type {
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
    reviewNotes?: string | undefined,
  ): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>>;
  reject(
    adminId: string,
    id: string,
    rejectionReason: string,
    reviewNotes?: string | undefined,
  ): Promise<Result<ItemSubmission, SubmissionError>>;
}
