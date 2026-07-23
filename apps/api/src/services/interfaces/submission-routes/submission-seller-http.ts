import type { CreateItemSubmissionInput, ItemSubmission, UserRole } from "@auction/types";
import type { createItemSubmissionSchema, listSubmissionsQuerySchema } from "@auction/validators";
import type { z } from "zod";
import type {
  SubmissionHttpJson,
  SubmissionLegalEntityContext,
  SubmissionViewerContext,
} from "./submission-route-http.js";

export interface ISubmissionSellerHttpApplicationService {
  createDraft(input: {
    body: z.infer<typeof createItemSubmissionSchema>;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  listMine(input: {
    query: z.infer<typeof listSubmissionsQuerySchema>;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  getMineSummary(input: { legalEntity: SubmissionLegalEntityContext }): Promise<SubmissionHttpJson>;

  getById(input: {
    submissionId: string;
    viewer: SubmissionViewerContext;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  patch(input: {
    submissionId: string;
    rawBody: unknown;
    viewer: SubmissionViewerContext;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  submitForReview(input: {
    submissionId: string;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  withdraw(input: {
    submissionId: string;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;
}

export type { CreateItemSubmissionInput, ItemSubmission, UserRole };
