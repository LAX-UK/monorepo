"use client";

import { StaffDocumentsSection } from "@/components/admin/documents/staff-documents-section";
import {
  adminAttachSubmissionDocumentResultAction,
  adminRemoveSubmissionDocumentResultAction,
} from "@/lib/actions/admin-documents";
import type { EntityDocument } from "@auction/types";
import { submissionDocumentKinds } from "@auction/types";
import { useMemo } from "react";

type Props = {
  submissionId: string;
  initialDocuments: EntityDocument[];
};

/** Files the seller uploaded and files staff attached to the submission. */
export function SubmissionDocumentsTab({ submissionId, initialDocuments }: Props) {
  const actions = useMemo(
    () => ({
      attach: (input: { uploadObjectId: string; kind: string; label: string | null }) =>
        adminAttachSubmissionDocumentResultAction(submissionId, input),
      remove: (documentId: string) =>
        adminRemoveSubmissionDocumentResultAction(submissionId, documentId),
    }),
    [submissionId],
  );
  return (
    <StaffDocumentsSection
      id="submission-documents"
      title="Documents"
      description="Seller uploads and staff attachments."
      entityKind="submission"
      kinds={submissionDocumentKinds}
      documents={initialDocuments}
      actions={actions}
      empty={{
        title: "No documents yet",
        description: "Upload provenance, condition or valuation files for this submission.",
      }}
    />
  );
}
