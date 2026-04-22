import type { approveSubmissionBodySchema, rejectSubmissionBodySchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type ApproveSubmissionBody = z.infer<typeof approveSubmissionBodySchema>;
export type RejectSubmissionBody = z.infer<typeof rejectSubmissionBodySchema>;

export type ApproveSubmissionResult = { lotId: string | undefined };

export interface IAdminSubmissionService {
  startReview(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  approve(id: string, body: ApproveSubmissionBody): Promise<ServiceResult<ApproveSubmissionResult>>;
  reject(id: string, body: RejectSubmissionBody): Promise<ServiceResult<Record<string, unknown>>>;
}
