import type { createItemSubmissionSchema, updateItemSubmissionSchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateItemSubmissionInput = z.infer<typeof createItemSubmissionSchema>;
export type UpdateItemSubmissionInput = z.infer<typeof updateItemSubmissionSchema>;

export type CreateSubmissionData = { id: string };

/**
 * The account a write is for. Without it the request uses the account in use; "Who is
 * selling?" names one explicitly, and the API checks the person may act for it.
 */
export type SubmissionAccountScope = { legalEntityId?: string | null | undefined };

export interface ISubmissionService {
  create(
    input: CreateItemSubmissionInput,
    scope?: SubmissionAccountScope,
  ): Promise<ServiceResult<CreateSubmissionData>>;
  update(
    id: string,
    input: UpdateItemSubmissionInput,
    scope?: SubmissionAccountScope,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  submitForReview(
    id: string,
    scope?: SubmissionAccountScope,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  withdraw(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  /** Accepts the consignment agreement, at the version the person read. */
  acceptAgreement(
    id: string,
    termsVersion: string,
  ): Promise<ServiceResult<Record<string, unknown>>>;
}
