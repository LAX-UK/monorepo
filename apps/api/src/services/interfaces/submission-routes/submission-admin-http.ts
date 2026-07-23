import type { ItemSubmissionStatus } from "@auction/types";
import type {
  adminAssignSubmissionBodySchema,
  adminBulkSubmissionsBodySchema,
  approveSubmissionBodySchema,
  listSubmissionsQuerySchema,
  rejectSubmissionBodySchema,
} from "@auction/validators";
import type { z } from "zod";
import type { SubmissionHttpJson, SubmissionViewerContext } from "./submission-route-http.js";

export interface ISubmissionAdminHttpApplicationService {
  listSubmissions(input: {
    query: z.infer<typeof listSubmissionsQuerySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  bulkApproveOrReject(input: {
    body: z.infer<typeof adminBulkSubmissionsBodySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  startReview(input: {
    submissionId: string;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  accept(input: {
    submissionId: string;
    body: z.infer<typeof approveSubmissionBodySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  convert(input: {
    submissionId: string;
    body: z.infer<typeof approveSubmissionBodySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  assign(input: {
    submissionId: string;
    body: z.infer<typeof adminAssignSubmissionBodySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  approve(input: {
    submissionId: string;
    body: z.infer<typeof approveSubmissionBodySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  reject(input: {
    submissionId: string;
    body: z.infer<typeof rejectSubmissionBodySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
}

export type { ItemSubmissionStatus };
