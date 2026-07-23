import type { attachSubmissionDocumentBodySchema } from "@auction/validators";
import type { z } from "zod";
import type {
  SubmissionHttpJson,
  SubmissionLegalEntityContext,
  SubmissionViewerContext,
} from "./submission-route-http.js";

export interface ISubmissionDocumentHttpApplicationService {
  listForViewer(input: {
    submissionId: string;
    viewer: SubmissionViewerContext;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  listForStaff(input: {
    submissionId: string;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  attachForViewer(input: {
    submissionId: string;
    body: z.infer<typeof attachSubmissionDocumentBodySchema>;
    viewer: SubmissionViewerContext;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  attachForStaff(input: {
    submissionId: string;
    body: z.infer<typeof attachSubmissionDocumentBodySchema>;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;

  removeForViewer(input: {
    submissionId: string;
    documentId: string;
    viewer: SubmissionViewerContext;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;

  removeForStaff(input: {
    submissionId: string;
    documentId: string;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
}
