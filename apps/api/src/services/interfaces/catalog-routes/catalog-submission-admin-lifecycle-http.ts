import type { ItemSubmission, Lot } from "@auction/types";
import type { ApproveSubmissionBody } from "@auction/validators";
import type { Result } from "neverthrow";
import type { SubmissionError } from "../../../lib/errors.js";

export type SubmissionAdminMutationResult = Result<ItemSubmission, SubmissionError>;
export type SubmissionConvertMutationResult = Result<
  { submission: ItemSubmission; lot: Lot; readinessPercent: number },
  SubmissionError
>;
export type SubmissionApproveMutationResult = Result<
  { submission: ItemSubmission; lot: Lot },
  SubmissionError
>;

export interface ICatalogSubmissionAdminLifecycleHttpApplicationService {
  startReview(adminId: string, submissionId: string): Promise<SubmissionAdminMutationResult>;
  accept(
    adminId: string,
    submissionId: string,
    body: ApproveSubmissionBody,
  ): Promise<SubmissionAdminMutationResult>;
  convert(
    adminId: string,
    submissionId: string,
    body: ApproveSubmissionBody,
  ): Promise<SubmissionConvertMutationResult>;
  assign(
    adminId: string,
    submissionId: string,
    assignedToUserId: string,
  ): Promise<SubmissionAdminMutationResult>;
  approve(
    adminId: string,
    submissionId: string,
    body: ApproveSubmissionBody,
  ): Promise<SubmissionApproveMutationResult>;
  reject(
    adminId: string,
    submissionId: string,
    rejectionReason: string,
    reviewNotes?: string,
  ): Promise<SubmissionAdminMutationResult>;
}
