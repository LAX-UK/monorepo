import type { approveSubmissionBodySchema, rejectSubmissionBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type ApproveSubmissionBody = z.infer<typeof approveSubmissionBodySchema>;
export type RejectSubmissionBody = z.infer<typeof rejectSubmissionBodySchema>;

export type ApproveSubmissionResult = { lotId: string | undefined };

export type ConvertSubmissionResult = ApproveSubmissionResult & {
  readinessPercent?: number;
};

export interface IAdminSubmissionService {
  startReview(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  accept(id: string, body: ApproveSubmissionBody): Promise<ServiceResult<Record<string, unknown>>>;
  convert(id: string, body: ApproveSubmissionBody): Promise<ServiceResult<ConvertSubmissionResult>>;
  approve(id: string, body: ApproveSubmissionBody): Promise<ServiceResult<ApproveSubmissionResult>>;
  reject(id: string, body: RejectSubmissionBody): Promise<ServiceResult<Record<string, unknown>>>;
  assign(
    id: string,
    assignedToUserId: string | null,
  ): Promise<ServiceResult<Record<string, unknown>>>;
}
